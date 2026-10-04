const mongoose = require("mongoose");
const Ambassador = require("../models/Ambassador");
const Prize = require("../models/Prize");
const PrizeRequest = require("../models/PrizeRequest");
const BonusPoints = require("../models/BonusPoints");
const AllFund = require("../models/AllFund");
const M = require("../models/WalletBridge");
const TIERS = { bronze: 1000, silver: 3000, gold: 5000, diamond: 10000 };
const ACTIVE_ORDERS = ["pending", "approved", "paid"];
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
function integer(value, min, max) {
  const n = Number(value);
  if (
    value === "" ||
    value == null ||
    !Number.isSafeInteger(n) ||
    n < min ||
    n > max
  )
    fail(422, "قيمة رقمية غير صالحة");
  return n;
}
function text(value, min = 1, max = 200) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(422, "تحقق من طول النص");
  return value.trim();
}
function httpsURL(value, optional = false) {
  if (optional && !value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.toString();
  } catch {}
  fail(422, "الرابط يجب أن يبدأ بـ HTTPS");
}
async function lockAmbassador(id, session) {
  const amb = await Ambassador.findOneAndUpdate(
    { _id: id },
    { $inc: { atharRevision: 1 } },
    { new: true, session },
  );
  if (!amb || amb.appSuspended) fail(403, "الحساب غير متاح");
  return amb;
}
async function balance(amb, session = null) {
  const funds =
    amb.platformProfileId && Number.isFinite(Number(amb.platformProfileId))
      ? await AllFund.find({ client_id: Number(amb.platformProfileId) })
          .session(session)
          .lean()
      : [];
  const bonuses = await BonusPoints.find({ ambassador: amb._id })
    .session(session)
    .lean();
  const requests = await PrizeRequest.find({
    ambassador: amb._id,
    status: { $in: ACTIVE_ORDERS },
  })
    .session(session)
    .lean();
  const raised = funds.reduce(
    (sum, f) => sum + Math.max(0, Number(f.currentTotal) || 0),
    0,
  );
  const available = Math.max(
    0,
    Math.floor(
      raised +
        bonuses.reduce((s, b) => s + b.amount, 0) -
        requests.reduce((s, r) => s + r.amount, 0),
    ),
  );
  return { available, funds, raised };
}
const cost = (p) => p.pointCost || TIERS[p.tier];
const orderStatus = {
  pending: "بانتظار المراجعة",
  approved: "معتمد — جارٍ التجهيز",
  rejected: "مرفوض — أعيدت النقاط",
  paid: "تم التسليم",
};
function receipt(r, available) {
  return {
    id: String(r._id),
    productID: r.prizeId,
    productName: r.prizeName,
    pointsSpent: r.amount,
    remainingPoints: available,
    statusText: orderStatus[r.status],
  };
}
async function redeem({
  ambassadorID,
  productID,
  tier,
  key,
  shippingAddress = "",
  mobile = false,
}) {
  return mongoose.connection.transaction(async (session) => {
    const amb = await lockAmbassador(ambassadorID, session);
    if (key) {
      const previous = await PrizeRequest.findOne({
        ambassador: amb._id,
        idempotencyKey: key,
      }).session(session);
      if (previous) {
        if (
          previous.prizeId !== productID ||
          previous.shippingAddress !== shippingAddress
        )
          fail(409, "مفتاح الطلب مستخدم لعملية مختلفة");
        return {
          replayed: true,
          order: previous,
          receipt: receipt(previous, (await balance(amb, session)).available),
        };
      }
    }
    let prize;
    if (productID) {
      prize = await Prize.findOneAndUpdate(
        { key: productID, active: true },
        { $inc: { atharRevision: 1 } },
        { new: true, session },
      );
      if (!prize || (tier && tier !== prize.tier))
        fail(409, "الجائزة غير متاحة");
      const taken = await PrizeRequest.countDocuments({
        prizeId: productID,
        status: { $in: ACTIVE_ORDERS },
      }).session(session);
      if (taken >= prize.stock) fail(409, "نفد مخزون الجائزة");
      if (mobile && prize.requiresShipping && !shippingAddress.trim())
        fail(422, "أدخل عنوان التوصيل");
    } else if (mobile || !TIERS[tier]) fail(422, "اختر الجائزة");
    const amount = prize ? cost(prize) : TIERS[tier];
    const funds = await balance(amb, session);
    if (funds.available < amount) fail(409, "رصيد النقاط غير كافٍ");
    const [order] = await PrizeRequest.create(
      [
        {
          ambassador: amb._id,
          amount,
          tier: prize?.tier || tier,
          prizeId: productID || "",
          prizeName: prize?.name || "",
          status: "pending",
          shippingAddress,
          ...(key ? { idempotencyKey: key } : {}),
        },
      ],
      { session },
    );
    await M.Audit.create(
      [
        {
          ambassador: String(amb._id),
          action: "store.redeem",
          reference: String(order._id),
          details: { amount },
        },
      ],
      { session },
    );
    return { order, receipt: receipt(order, funds.available - amount) };
  });
}
async function setOrderStatus(id, status, note, admin) {
  return mongoose.connection.transaction(async (session) => {
    const order = await PrizeRequest.findById(id).session(session);
    if (!order) fail(404, "الطلب غير موجود");
    await lockAmbassador(order.ambassador, session);
    if (order.status === status) return order;
    const allowed = {
      pending: ["approved", "rejected"],
      approved: ["paid", "rejected"],
      paid: [],
      rejected: [],
    };
    if (!allowed[order.status]?.includes(status))
      fail(409, "انتقال حالة الطلب غير مسموح");
    if (order.prizeId)
      await Prize.updateOne(
        { key: order.prizeId },
        { $inc: { atharRevision: 1 } },
        { session },
      );
    order.status = status;
    order.note = note;
    await order.save({ session });
    await M.Audit.create(
      [
        {
          admin: String(admin),
          action: "store.status",
          reference: id,
          details: { status, note },
        },
      ],
      { session },
    );
    return order;
  });
}

async function startHeartbeat() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw Error("Wallet requires replica set");
  await Promise.all([PrizeRequest.createIndexes(), BonusPoints.createIndexes(), M.Compatibility.createIndexes()]);
  const beat = () => M.Compatibility.updateOne({ key: "platform-wallet" }, { version: 1, checkedAt: new Date() }, { upsert: true });
  await beat();
  const timer = setInterval(() => beat().catch(() => console.error("Wallet compatibility heartbeat failed")), 30000);
  timer.unref();
}
module.exports = { redeem, setOrderStatus, lockAmbassador, balance, fail, startHeartbeat };

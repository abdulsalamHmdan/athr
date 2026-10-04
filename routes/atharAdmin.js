const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { requireAdmin } = require("../middleware/auth");
const { wrap, id } = require("./atharMobile");
const {
  M,
  fail,
  integer,
  text,
  httpsURL,
  settings,
  phase,
  allocate,
  ACTIVE_ORDERS,
  setOrderStatus,
} = require("../services/atharCore");
const Prize = require("../models/Prize");
const PrizeRequest = require("../models/PrizeRequest");
const AllFund = require("../models/AllFund");
const Ambassador = require("../models/Ambassador");
const router = express.Router();
router.use(requireAdmin);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  req.session.atharCSRF ||= crypto.randomBytes(32).toString("hex");
  if (req.method !== "GET" && req.get("X-CSRF-Token") !== req.session.atharCSRF)
    return res.status(403).json({ message: "حدّث الصفحة وأعد المحاولة" });
  next();
});
const audit = (req, action, reference, details, session) =>
  M.Audit.create(
    [
      {
        admin: String(req.session.adminId),
        action,
        reference: String(reference),
        details,
      },
    ],
    { session },
  );
router.get("/", (req, res) =>
  res.render("admin/athar", { csrf: req.session.atharCSRF }),
);
router.get(
  "/data",
  wrap(async (req, res) => {
    const config = await settings();
    const products = await Prize.find().sort({ order: 1 }).lean();
    for (const p of products)
      p.availableStock = Math.max(
        0,
        p.stock -
          (await PrizeRequest.countDocuments({
            prizeId: p.key,
            status: { $in: ACTIVE_ORDERS },
          })),
      );
    res.json({
      config,
      products,
      missions: await M.Mission.find().sort({ createdAt: -1 }).lean(),
      competitions: await M.Competition.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      boxes: await M.Box.find()
        .populate("ambassador", "name phone platformProfileId")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      orders: await PrizeRequest.find()
        .populate("ambassador", "name phone")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      audit: await M.Audit.find().sort({ createdAt: -1 }).limit(50).lean(),
    });
  }),
);
router.post(
  "/settings",
  wrap(async (req, res) => {
    const b = req.body,
      data = {};
    for (const k of [
      "enabled",
      "storeEnabled",
      "boxesEnabled",
      "competitionsEnabled",
      "missionsEnabled",
      "gameEnabled",
    ]) {
      if (typeof b[k] !== "boolean") fail(422, "قيمة تشغيل غير صالحة");
      data[k] = b[k];
    }
    data.maintenanceMessage = text(b.maintenanceMessage, 1, 500);
    data.generalShareURL = httpsURL(b.generalShareURL);
    data.supportURL = httpsURL(b.supportURL);
    data.privacyURL = httpsURL(b.privacyURL, true);
    data.termsURL = httpsURL(b.termsURL, true);
    data.seasonTarget = integer(b.seasonTarget, 1, 1000000000);
    data.maxBoxesPerDay = integer(b.maxBoxesPerDay, 1, 20);
    if (data.enabled && (!data.privacyURL || !data.termsURL))
      fail(422, "أضف روابط الخصوصية والشروط قبل تفعيل التطبيق");
    // Financial operations require transactions; refuse activation on standalone MongoDB.
    if (data.enabled) {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      if (!hello.setName && hello.msg !== "isdbgrid")
        fail(503, "يلزم MongoDB Replica Set لتفعيل العمليات الآمنة");
    }
    await mongoose.connection.transaction(async (session) => {
      await M.Settings.findOneAndUpdate(
        { key: "app" },
        { $set: data },
        { upsert: true, session },
      );
      await audit(req, "settings.update", "app", data, session);
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/products",
  wrap(async (req, res) => {
    const b = req.body,
      key = text(b.key, 1, 60);
    if (!/^[a-zA-Z0-9_-]+$/.test(key))
      fail(422, "معرف المنتج يجب أن يكون حروفًا وأرقامًا إنجليزية");
    if (!["bronze", "silver", "gold", "diamond"].includes(b.tier))
      fail(422, "الفئة غير صالحة");
    const data = {
      name: text(b.name, 1, 200),
      description: text(b.description || "", 0, 1000),
      tier: b.tier,
      stock: integer(b.stock, 0, 1000000),
      pointCost: integer(b.pointCost, 1, 100000000),
      active: b.active === true,
      requiresShipping: b.requiresShipping === true,
    };
    await mongoose.connection.transaction(async (session) => {
      let prize = await Prize.findOneAndUpdate(
        { key },
        { $inc: { atharRevision: 1 } },
        { new: true, session },
      );
      const reserved = await PrizeRequest.countDocuments({
        prizeId: key,
        status: { $in: ACTIVE_ORDERS },
      }).session(session);
      if (data.stock < reserved)
        fail(409, "إجمالي المخزون أقل من الطلبات المحجوزة");
      if (!prize) prize = new Prize({ key, ...data });
      else Object.assign(prize, data);
      await prize.save({ session });
      await audit(req, "product.save", key, data, session);
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/orders/:id",
  wrap(async (req, res) => {
    const status = text(req.body.status, 1, 30);
    await setOrderStatus(
      id(req.params.id),
      status,
      text(req.body.note || "", 0, 500),
      req.session.adminId,
    );
    res.json({ ok: true });
  }),
);
router.post(
  "/boxes/:id",
  wrap(async (req, res) => {
    const state = req.body.state;
    if (!["pendingReview", "active", "paused", "completed"].includes(state))
      fail(422, "حالة غير صالحة");
    await mongoose.connection.transaction(async (session) => {
      const box = await M.Box.findById(id(req.params.id)).session(session);
      if (!box) fail(404, "الصندوق غير موجود");
      if (state === "active" || state === "completed") {
        const externalId = integer(
          req.body.externalId,
          1,
          Number.MAX_SAFE_INTEGER,
        );
        const amb = await Ambassador.findById(box.ambassador).session(session);
        const fund = await AllFund.findOne({
          id: externalId,
          client_id: Number(amb.platformProfileId),
        }).session(session);
        if (!amb.platformProfileId || !fund)
          fail(
            422,
            "الصندوق غير موجود ضمن صناديق السفير المتزامنة من منصة التبرع",
          );
        if (
          await M.Box.exists({ _id: { $ne: box._id }, externalId }).session(
            session,
          )
        )
          fail(409, "الصندوق مربوط بطلب آخر");
        box.externalId = externalId;
        box.shareURL = `https://donate.utq.org.sa/goal_${externalId}`;
      }
      box.state = state;
      box.note = text(req.body.note || "", 0, 500);
      await box.save({ session });
      await audit(
        req,
        "box.update",
        box._id,
        { state, externalId: box.externalId },
        session,
      );
    });
    res.json({ ok: true });
  }),
);
function date(value) {
  const d = new Date(value);
  if (!Number.isFinite(+d)) fail(422, "التاريخ غير صالح");
  return d;
}
router.post(
  "/missions",
  wrap(async (req, res) => {
    const b = req.body;
    if (
      ![
        "shareGeneralLink",
        "createMemorialBox",
        "firstBoxDonation",
        "weeklyImpact",
        "playPuzzle",
      ].includes(b.kind)
    )
      fail(422, "نوع مهمة غير صالح");
    const data = {
      title: text(b.title, 1, 150),
      detail: text(b.detail, 1, 1000),
      kind: b.kind,
      target: integer(b.target, 1, 10000000),
      seedReward: integer(b.seedReward, 0, 10000),
      rewardPointBonus: integer(b.rewardPointBonus, 0, 100000),
      startsAt: date(b.startsAt),
      endsAt: date(b.endsAt),
      active: b.active === true,
    };
    if (data.endsAt <= data.startsAt)
      fail(422, "نهاية المهمة يجب أن تكون بعد بدايتها");
    if (
      ["shareGeneralLink", "playPuzzle"].includes(data.kind) &&
      data.rewardPointBonus > 0
    )
      fail(422, "المشاركة والتدريب يمنحان نقاط تدريب فقط");
    await mongoose.connection.transaction(async (session) => {
      if (b.id) {
        const m = await M.Mission.findById(id(b.id)).session(session);
        if (!m) fail(404, "المهمة غير موجودة");
        if (m.startsAt <= new Date())
          fail(409, "المهمة بدأت؛ أنشئ مهمة جديدة لتغيير الشروط");
        Object.assign(m, data);
        await m.save({ session });
        await audit(req, "mission.update", m._id, data, session);
      } else {
        const [m] = await M.Mission.create([data], { session });
        await audit(req, "mission.create", m._id, data, session);
      }
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/missions/:id/toggle",
  wrap(async (req, res) => {
    await mongoose.connection.transaction(async (session) => {
      await M.Mission.updateOne(
        { _id: id(req.params.id) },
        { $set: { active: req.body.active === true } },
        { session },
      );
      await audit(
        req,
        "mission.toggle",
        req.params.id,
        { active: req.body.active === true },
        session,
      );
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/competitions",
  wrap(async (req, res) => {
    const b = req.body;
    if (
      !Array.isArray(b.questions) ||
      b.questions.length < 1 ||
      b.questions.length > 100
    )
      fail(422, "أضف من سؤال إلى 100 سؤال");
    const questions = b.questions.map((q) => {
      if (!Array.isArray(q.choices) || q.choices.length !== 4)
        fail(422, "لكل سؤال أربعة خيارات");
      return {
        text: text(q.text, 3, 1000),
        choices: q.choices.map((v) => text(v, 1, 300)),
        correctIndex: integer(q.correctIndex, 0, 3),
        explanation: text(q.explanation, 1, 2000),
        reference: text(q.reference, 1, 500),
        approved: q.approved === true,
      };
    });
    const data = {
      title: text(b.title, 1, 150),
      scheduledAt: date(b.scheduledAt),
      rewardPool: integer(b.rewardPool, 0, 100000000),
      durationSeconds: integer(b.durationSeconds, 5, 120),
      revealSeconds: integer(b.revealSeconds, 3, 60),
      eligibilityPercent: integer(b.eligibilityPercent, 1, 100),
      questions,
    };
    await mongoose.connection.transaction(async (session) => {
      let c = b.id
        ? await M.Competition.findById(id(b.id)).session(session)
        : new M.Competition();
      if (!c) fail(404, "المسابقة غير موجودة");
      if (c.state !== "draft") fail(409, "يمكن تعديل المسودة فقط");
      Object.assign(c, data);
      await c.save({ session });
      await audit(req, "competition.save", c._id, { title: c.title }, session);
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/competitions/:id/action",
  wrap(async (req, res) => {
    const action = req.body.action;
    await mongoose.connection.transaction(async (session) => {
      const c = await M.Competition.findById(id(req.params.id)).session(
        session,
      );
      if (!c) fail(404, "المسابقة غير موجودة");
      const now = new Date();
      if (action === "schedule") {
        if (
          c.state !== "draft" ||
          !c.questions.length ||
          c.questions.some((q) => !q.approved)
        )
          fail(409, "اعتمد كل الأسئلة قبل الجدولة");
        if (c.scheduledAt <= now) fail(422, "اختر موعدًا مستقبليًا");
        c.state = "scheduled";
      } else if (action === "start") {
        if (c.state !== "scheduled") fail(409, "المسابقة غير مجدولة");
        if (c.scheduledAt > now) fail(409, "لم يحن موعد المسابقة");
        c.state = "live";
        c.startedAt = now;
      } else if (action === "pause") {
        if (c.state !== "live" || phase(c, now).state === "calculating")
          fail(409, "لا يمكن إيقاف المسابقة الآن");
        c.state = "paused";
        c.pausedAt = now;
      } else if (action === "resume") {
        if (c.state !== "paused") fail(409, "المسابقة غير متوقفة");
        c.startedAt = new Date(+c.startedAt + (now - c.pausedAt));
        c.pausedAt = null;
        c.state = "live";
      } else if (action === "cancel") {
        if (["published", "archived", "cancelled"].includes(c.state))
          fail(409, "لا يمكن إلغاء هذه المسابقة");
        c.state = "cancelled";
      } else if (action === "publish") {
        if (c.state === "published") return;
        if (c.state !== "live" || phase(c, now).state !== "calculating")
          fail(409, "انتظر اكتمال جميع الأسئلة");
        const answers = await M.Answer.find({ competition: String(c._id) })
          .session(session)
          .lean();
        const people = await M.Participant.find({ competition: String(c._id) })
          .session(session)
          .lean();
        const rows = people.map((p) => {
          const a = answers.filter(
            (a) => String(a.ambassador) === String(p.ambassador),
          );
          return {
            ambassador: String(p.ambassador),
            name: p.name,
            score: a.reduce((s, a) => s + a.score, 0),
            answered: a.length,
          };
        });
        c.results = allocate(
          c.rewardPool,
          rows,
          c.questions.length,
          c.eligibilityPercent,
        );
        c.state = "published";
      } else if (action === "archive") {
        if (c.state !== "cancelled")
          fail(409, "تؤرشف المسابقات الملغاة فقط حتى لا تضيع حقوق الاستلام");
        c.state = "archived";
      } else fail(422, "إجراء غير صالح");
      c.revision++;
      await c.save({ session });
      await audit(
        req,
        `competition.${action}`,
        c._id,
        {
          state: c.state,
          distributed: c.results.reduce((s, r) => s + r.points, 0),
        },
        session,
      );
    });
    res.json({ ok: true });
  }),
);
router.get(
  "/competitions/:id/results",
  wrap(async (req, res) => {
    const c = await M.Competition.findById(id(req.params.id)).lean();
    if (!c) fail(404, "المسابقة غير موجودة");
    const answers = await M.Answer.find({ competition: String(c._id) }).lean();
    const people = await M.Participant.find({
      competition: String(c._id),
    }).lean();
    const rows = people.map((p) => {
      const a = answers.filter(
        (a) => String(a.ambassador) === String(p.ambassador),
      );
      return {
        ambassador: String(p.ambassador),
        name: p.name,
        score: a.reduce((s, a) => s + a.score, 0),
        answered: a.length,
      };
    });
    res.json({
      state: phase(c).state,
      rewardPool: c.rewardPool,
      results:
        c.state === "published"
          ? c.results
          : allocate(
              c.rewardPool,
              rows,
              c.questions.length,
              c.eligibilityPercent,
            ),
    });
  }),
);
router.get(
  "/audit.csv",
  wrap(async (req, res) => {
    const rows = await M.Audit.find()
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();
    const cell = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""') +
      '"';
    res
      .type("text/csv")
      .attachment("athar-audit.csv")
      .send(
        "\uFEFF" +
          [
            ["date", "admin", "ambassador", "action", "reference", "details"],
            ...rows.map((r) => [
              r.createdAt.toISOString(),
              r.admin,
              r.ambassador,
              r.action,
              r.reference,
              JSON.stringify(r.details),
            ]),
          ]
            .map((r) => r.map(cell).join(","))
            .join("\n"),
      );
  }),
);
router.use((err, req, res, next) =>
  res
    .status(err.status || 500)
    .json({
      message: err.status
        ? err.message
        : "تعذّر حفظ التغيير؛ تحقق من الإعدادات واتصال قاعدة البيانات",
    }),
);
module.exports = router;

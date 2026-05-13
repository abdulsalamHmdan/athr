const express = require("express");
const Fund = require("../models/Fund");
const AllFund = require("../models/AllFund");
const Ambassador = require("../models/Ambassador");
const { listEntities, entityName } = require("../services/entities");
const { logAmbassadorActivity } = require("../services/activityLog");
const router = express.Router();
const cache = require("memory-cache");
dotenv = require("dotenv");
dotenv.config();
// دالة الوسيط (Middleware) الخاصة بالكاش
let cacheM = (duration) => {
  return (req, res, next) => {
    let key = "__express__" + (req.originalUrl || req.url);
    let cachedBody = cache.get(key);

    if (cachedBody) {
      res.send(cachedBody);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        cache.put(key, body, duration * 1000 * 60); // المدة بالثواني
        res.sendResponse(body);
      };
      next();
    }
  };
};

// ===== Public APIs (لا تتطلب تسجيل دخول) =====

// قائمة المجمعات مع إحصائيات مختصرة لكل مجمع
router.get("/public/centers", async (req, res) => {
  try {
    const entities = listEntities();
    const ambassadors = await Ambassador.find(
      {},
      "entity platformProfileId",
    ).lean();

    const clientIds = ambassadors
      .map((a) => Number(a.platformProfileId))
      .filter((n) => Number.isFinite(n));
    const fundsList = await AllFund.find(
      { client_id: { $in: clientIds } },
      "client_id currentTotal",
    ).lean();

    const totalsByClient = new Map();
    const countByClient = new Map();
    for (const f of fundsList) {
      const cid = Number(f.client_id);
      const amount = Number(f.currentTotal) || 0;
      totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
      if (amount > 0) {
        countByClient.set(cid, (countByClient.get(cid) || 0) + 1);
      }
    }

    const stats = entities.map((e) => {
      const ambs = ambassadors.filter(
        (a) => String(a.entity || "") === String(e.id),
      );
      let totalDonations = 0;
      let fundsCount = 0;
      for (const a of ambs) {
        const cid = Number(a.platformProfileId);
        if (!Number.isFinite(cid)) continue;
        totalDonations += totalsByClient.get(cid) || 0;
        fundsCount += countByClient.get(cid) || 0;
      }
      return {
        id: e.id,
        name: e.name,
        ambassadorsCount: ambs.length,
        totalDonations,
        fundsCount,
      };
    });

    res.json({ centers: stats });
  } catch (e) {
    res.status(500).json({ error: "failed" });
  }
});

// تفاصيل مجمع محدد + قائمة السفراء مرتبة من الأعلى للأقل
router.get("/public/centers/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ambassadors = await Ambassador.find(
      { entity: id },
      "name phone platformProfileId donationsUpdatedAt",
    ).lean();

    const clientIds = ambassadors
      .map((a) => Number(a.platformProfileId))
      .filter((n) => Number.isFinite(n));
    const fundsList = await AllFund.find(
      { client_id: { $in: clientIds } },
      "client_id currentTotal",
    ).lean();

    const totalsByClient = new Map();
    const countByClient = new Map();
    for (const f of fundsList) {
      const cid = Number(f.client_id);
      const amount = Number(f.currentTotal) || 0;
      totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
      if (amount > 0) {
        countByClient.set(cid, (countByClient.get(cid) || 0) + 1);
      }
    }

    const list = ambassadors.map((a) => {
      const cid = Number(a.platformProfileId);
      const total = Number.isFinite(cid) ? totalsByClient.get(cid) || 0 : 0;
      const count = Number.isFinite(cid) ? countByClient.get(cid) || 0 : 0;
      return {
        id: String(a._id),
        name: a.name,
        phone: a.phone,
        totalDonations: total,
        fundsCount: count,
        donationsUpdatedAt: a.donationsUpdatedAt,
      };
    });
    list.sort((a, b) => b.totalDonations - a.totalDonations);

    const totalDonations = list.reduce((s, a) => s + a.totalDonations, 0);
    const fundsCount = list.reduce((s, a) => s + a.fundsCount, 0);

    res.json({
      center: {
        id,
        name: entityName(id),
        ambassadorsCount: list.length,
        fundsCount,
        totalDonations,
      },
      ambassadors: list,
    });
  } catch (e) {
    res.status(500).json({ error: "failed" });
  }
});

const GOALS_API =
  "https://donate.utq.org.sa/api/v1/orders/report/goals:ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ";

router.get("/donations-all", async (req, res) => {
  try {
    const agg = await AllFund.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$currentTotal", 0] } },
          orderCount: { $sum: { $ifNull: ["$orderCount", 0] } },
        },
      },
    ]);
    const row = agg[0] || { total: 0, orderCount: 0 };
    res.json({
      total: row.total || 0,
      orderCount: row.orderCount || 0,
      currency: "SAR",
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.json({
      total: 0,
      orderCount: 0,
      currency: "SAR",
      error: "fetch_failed",
    });
  }
});

router.get("/donations/:phone", cacheM(5), async (req, res) => {
  const phone = req.params.phone;
  try {
    const amb = await Ambassador.findOne({ phone }).lean();
    const clientId = amb && amb.platformProfileId ? Number(amb.platformProfileId) : null;

    if (!clientId) {
      return res.json({
        phone,
        total: 0,
        orderCount: 0,
        items: [],
        currency: "SAR",
        updatedAt: new Date().toISOString(),
      });
    }

    const funds = await AllFund.find({ client_id: clientId }).lean();
    const total = funds.reduce((s, f) => s + (Number(f.currentTotal) || 0), 0);
    const orderCount = funds.reduce((s, f) => s + (Number(f.orderCount) || 0), 0);
    const items = funds.map((f) => ({
      pk: f.id,
      name: f.name || "",
      total: Number(f.currentTotal) || 0,
      goal: Number(f.price_goal) || 800,
    }));
    res.json({
      phone,
      total,
      orderCount,
      items,
      currency: "SAR",
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.json({
      phone,
      total: 0,
      orderCount: 0,
      items: [],
      currency: "SAR",
      error: "fetch_failed",
    });
  }
});

// ===== بيانات وهمية مؤقتة — استبدلها بالـ API الحقيقي لاحقاً =====
const PLATFORM_URL = "https://donate.utq.org.sa/clients/otp_login";

// التحقق إن كان السفير عنده حساب على المنصة
router.get("/platform/check-account/:phone", async (req, res) => {
  const phone = req.params.phone;
  // بيانات وهمية: أي رقم ينتهي بـ 0 يُعتبر بدون حساب
  const hasAccount = !phone.endsWith("0");
  res.json({
    phone,
    hasAccount,
    platformUrl: PLATFORM_URL,
  });
});

// إنشاء صندوق جديد على المنصة
router.post("/platform/create-fund", async (req, res) => {
  const { name, targetAmount, waqfType, acceptAfterTarget, ownerPhone } =
    req.body || {};
  if (!name || !targetAmount || !waqfType) {
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  }

  if (!req.session || !req.session.ambassadorId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let ambassador;
  try {
    ambassador = await Ambassador.findById(req.session.ambassadorId);
  } catch (e) {
    console.error("Error finding ambassador:", e);
    return res.status(500).json({ error: "فشل التحقق من السفير" });
  }
  if (!ambassador) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let fetchData;
  try {
    const fetchResult = await fetch(
      `https://donate.utq.org.sa/api/v1/goal/new?type=51&name=${name}&prod_id=${waqfType}&client_id=${ambassador.platformProfileId}&price_goal=${targetAmount}&approved=1`,
      {
        method: "get",
        headers: {
          k: process.env.Donate_token || "",
        },
      },
    );
    fetchData = await fetchResult.json();
  } catch (e) {
    console.error("Error creating fund on platform:", e);
    return res.status(500).json({ error: "فشل إنشاء الصندوق" });
  }

  if (!fetchData?.result?.id) {
    console.error("Platform did not return fund id:", fetchData);
    return res.status(500).json({ error: "فشل إنشاء الصندوق" });
  }

  try {
    await logAmbassadorActivity({
      ambassadorId: ambassador._id,
      action: "create_fund",
      details: {
        fundId: fetchData?.result?.id || "",
        fundName: fetchData?.result?.name || name,
        targetAmount: Number(
          fetchData?.result?.price_goal || targetAmount || 0,
        ),
      },
      source: "server",
      path: "/api/platform/create-fund",
    });
  } catch (e) {
    console.error("Error logging activity:", e);
  }

  try {
    await AllFund.create({
      id: Number(fetchData.result.id),
      name: fetchData.result.name || name,
      price_goal: Number(fetchData.result.price_goal || targetAmount || 0),
      client_id: Number(ambassador.platformProfileId) || null,
      prod_id: Number(waqfType) || null,
      type: 51,
      total: 0,
      currentTotal: 0,
      orderCount: 0,
      done: "c",
      phone: ownerPhone || "",
      stats: {},
    });
  } catch (e) {
    console.error("Error saving fund locally:", e);
  }

  return res.json({
    ok: true,
    fund: {
      id: fetchData.result.id,
      externalId: fetchData.result.id,
      name: fetchData.result.name,
      targetAmount: Number(fetchData.result.price_goal),
      waqfType,
      acceptAfterTarget: !!acceptAfterTarget,
      phone: ambassador.phone || "",
      ownerPhone: ownerPhone || "",
      shareUrl: `https://donate.utq.org.sa/goal_${fetchData.result.id}`,
      createdAt: new Date().toISOString(),
    },
  });

  // const fundId = saved ? String(saved._id);
  // const shareUrl = `${PLATFORM_URL.replace(/\/+$/, '')}/funds/${encodeURIComponent(externalId)}`;
});

// ===== Mock platform APIs (استبدلها بالـ API الحقيقي عبر متغيرات .env) =====
// PLATFORM_VERIFY_URL  → POST  body: { phone, name }   → { profileId, hasAccount, created }
// PLATFORM_DONATIONS_URL → GET  ?phone=&profileId=     → { total }

router.post("/platform/verify-or-create", (req, res) => {
  const { phone, name } = req.body || {};
  if (!phone) return res.status(400).json({ error: "phone_required" });
  const hasAccount = !String(phone).endsWith("0");
  res.json({
    profileId: `mock-${phone}`,
    hasAccount,
    created: !hasAccount,
    name: name || "",
  });
});

router.get("/platform/donations-total", (req, res) => {
  const { phone } = req.query;
  const seed = String(phone || "")
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  res.json({ total: (seed % 50) * 100, currency: "SAR" });
});

module.exports = router;

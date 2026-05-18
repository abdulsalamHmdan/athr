const express = require("express");
const Fund = require("../models/Fund");
const AllFund = require("../models/AllFund");
const Ambassador = require("../models/Ambassador");
const AmbassadorActivity = require("../models/AmbassadorActivity");
const SyncMeta = require("../models/SyncMeta");
const { listEntities, entityName } = require("../services/entities");
const { logAmbassadorActivity } = require("../services/activityLog");
const boardControl = require("../services/boardControl");
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

// ===== Dashboard (شاشة العمليات) — يجمّع كل المؤشرات من قاعدة البيانات =====
function classifyEntityKind(entity) {
  const sid = String((entity && entity.id) || "");
  if (sid === "330") return "إدارة";
  if (sid === "550") return "خارج";
  const s = String((entity && entity.name) || "").trim();
  if (s.startsWith("مجمع")) return "بنين";
  return "بنات";
}

const arabicDigitsServer = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => arabicDigitsServer[+d]);
}
function formatAgoArabic(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return "قبل " + toArabicDigits(s) + " ث";
  if (s < 3600) return "قبل " + toArabicDigits(Math.floor(s / 60)) + " د";
  if (s < 86400) return "قبل " + toArabicDigits(Math.floor(s / 3600)) + " س";
  return "قبل " + toArabicDigits(Math.floor(s / 86400)) + " يوم";
}

router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const entities = listEntities();
    const entityById = new Map();
    for (const e of entities) {
      entityById.set(String(e.id), { ...e, kind: classifyEntityKind(e) });
    }

    const ambassadors = await Ambassador.find(
      {},
      "name entity isMember platformProfileId createdAt",
    ).lean();

    const ambassadorsTotal = ambassadors.length;
    const ambassadorsMembers = ambassadors.filter((a) => a.isMember).length;
    const ambassadorsExternal = ambassadorsTotal - ambassadorsMembers;
    const ambassadorsDelta7d = ambassadors.filter(
      (a) => a.createdAt && new Date(a.createdAt) >= sevenDaysAgo,
    ).length;

    const ambByClient = new Map();
    const clientIds = [];
    for (const a of ambassadors) {
      const cid = Number(a.platformProfileId);
      if (Number.isFinite(cid)) {
        ambByClient.set(cid, a);
        clientIds.push(cid);
      }
    }

    // نأخذ فقط الصناديق المعتمدة: a = مكتمل، b = نشط. نتجاهل c تماماً.
    const funds = await AllFund.find(
      { currentTotal: { $gt: 0 }, },
      "client_id name currentTotal price_goal done updatedAt",
    ).lean();
    // console.log("Fetched funds count:", funds.length);

    let totalDonations = 0;
    let donationsGoalSum = 0;
    let donationsToday = 0;
    let fundsTotal = 0;
    let fundsActive = 0;
    let fundsCompleted = 0;
    let fundsCompletedToday = 0;
    const totalsByClient = new Map();
    const goalsByClient = new Map();
    const countByClient = new Map();
    const completedByClient = new Map();

    for (const f of funds) {
      const cid = Number(f.client_id);
      const amount = Number(f.currentTotal) || 0;
      const goal = Number(f.price_goal) || 0;
      const updatedToday =
        f.updatedAt && new Date(f.updatedAt) >= startOfDay;

      totalDonations += amount;
      donationsGoalSum += goal;
      fundsTotal++;
      if (f.done === "a") {
        fundsCompleted++;
        if (updatedToday) fundsCompletedToday++;
      } else if (f.done === "b") {
        fundsActive++;
      }
      if (updatedToday) donationsToday += amount;

      totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
      goalsByClient.set(cid, (goalsByClient.get(cid) || 0) + goal);
      countByClient.set(cid, (countByClient.get(cid) || 0) + 1);
      if (f.done === "a") {
        completedByClient.set(cid, (completedByClient.get(cid) || 0) + 1);
      }
    }

    const donationsGoal = donationsGoalSum > 0 ? donationsGoalSum : 500000;
    const fundsGoal = Math.max(fundsTotal, 100);

    const entitiesWithAmbs = new Set(
      ambassadors.map((a) => String(a.entity || "")).filter(Boolean),
    );
    const entitiesCount = entitiesWithAmbs.size;

    let liveAmbassadors = 0;
    try {
      const recent = await AmbassadorActivity.distinct("ambassador", {
        createdAt: { $gte: new Date(now.getTime() - 15 * 60 * 1000) },
      });
      liveAmbassadors = recent.length;
    } catch (_) {}

    const entityStats = new Map();
    for (const a of ambassadors) {
      const eid = String(a.entity || "");
      const ent = entityById.get(eid);
      if (!ent) continue;
      let s = entityStats.get(eid);
      if (!s) {
        s = {
          id: eid,
          name: ent.name,
          kind: ent.kind,
          amount: 0,
          ambassadors: 0,
          funds: 0,
          goal: 0,
        };
        entityStats.set(eid, s);
      }
      s.ambassadors++;
      const cid = Number(a.platformProfileId);
      if (Number.isFinite(cid)) {
        s.amount += totalsByClient.get(cid) || 0;
        s.funds += countByClient.get(cid) || 0;
        s.goal += goalsByClient.get(cid) || 0;
      }
    }

    function pickTopAmbassador(kind) {
      let best = null;
      for (const a of ambassadors) {
        const ent = entityById.get(String(a.entity || ""));
        if (!ent || ent.kind !== kind) continue;
        const cid = Number(a.platformProfileId);
        if (!Number.isFinite(cid)) continue;
        const amount = totalsByClient.get(cid) || 0;
        if (!best || amount > best.amount) {
          const ambGoal = goalsByClient.get(cid) || 0;
          best = {
            name: a.name || "—",
            entity: ent.name,
            amount,
            funds: countByClient.get(cid) || 0,
            pct: ambGoal > 0
              ? Math.min(100, Math.round((amount / ambGoal) * 100))
              : 0,
          };
        }
      }
      return best || { name: "—", entity: "—", amount: 0, funds: 0, pct: 0 };
    }

    function pickTopEntity(kind) {
      let best = null;
      for (const s of entityStats.values()) {
        if (s.kind !== kind) continue;
        if (!best || s.amount > best.amount) {
          best = {
            name: s.name,
            amount: s.amount,
            ambassadors: s.ambassadors,
            funds: s.funds,
            pct: s.goal > 0
              ? Math.min(100, Math.round((s.amount / s.goal) * 100))
              : 0,
          };
        }
      }
      return best || { name: "—", amount: 0, ambassadors: 0, funds: 0, pct: 0 };
    }

    const topBoys = {
      ambassador: pickTopAmbassador("بنين"),
      entity: pickTopEntity("بنين"),
    };
    const topGirls = {
      ambassador: pickTopAmbassador("بنات"),
      entity: pickTopEntity("بنات"),
    };

    const liveFeed = [];
    try {
      const acts = await AmbassadorActivity.find({
        action: {
          $in: [
            "create_fund",
            "create_fund_success",
            "request_prize",
            "share_fund_link",
            "share_created_fund_link",
          ],
        },
      })
        .populate("ambassador", "name entity")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();
      for (const a of acts) {
        const name = (a.ambassador && a.ambassador.name) || "سفير";
        const ago = formatAgoArabic(
          (now.getTime() - new Date(a.createdAt).getTime()) / 1000,
        );
        if (a.action === "create_fund" || a.action === "create_fund_success") {
          const fundName =
            (a.details && a.details.fundName) || "صندوق جديد";
          liveFeed.push(
            `🎉 السفير ${name} فعّل صندوقاً جديداً · ${fundName} — ${ago}`,
          );
        } else if (a.action === "request_prize") {
          const tier =
            a.details && a.details.tier ? ` (${a.details.tier})` : "";
          liveFeed.push(`🏆 ${name} طلب صرف جائزة${tier} — ${ago}`);
        } else {
          liveFeed.push(`📤 ${name} شارك رابط صندوق — ${ago}`);
        }
      }
    } catch (_) {}

    try {
      const newAmbs = await Ambassador.find({}, "name entity createdAt")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();
      for (const a of newAmbs) {
        if (!a.createdAt) continue;
        const seconds =
          (now.getTime() - new Date(a.createdAt).getTime()) / 1000;
        if (seconds > 7 * 24 * 3600) continue;
        const eName =
          (entityById.get(String(a.entity || "")) || {}).name || "";
        liveFeed.push(
          `👤 سفير جديد التحق · ${a.name}${eName ? ` — ${eName}` : ""} — ${formatAgoArabic(seconds)}`,
        );
      }
    } catch (_) {}

    if (!liveFeed.length) {
      liveFeed.push("في انتظار أول نشاط من السفراء…");
    }

    let lastSyncAt = null;
    try {
      const meta = await SyncMeta.findOne({ key: "funds" }).lean();
      lastSyncAt = meta && meta.lastSyncAt ? meta.lastSyncAt : null;
    } catch (_) {}

    res.set("Cache-Control", "no-store");
    res.json({
      stats: {
        ambassadorsTotal,
        ambassadorsMembers,
        ambassadorsExternal,
        ambassadorsDelta7d,
        totalDonations: Math.round(totalDonations),
        donationsGoal: Math.round(donationsGoal),
        donationsToday: Math.round(donationsToday),
        fundsTotal,
        fundsActive,
        fundsCompleted,
        fundsCompletedToday,
        fundsGoal,
        entities: entitiesCount,
        liveAmbassadors,
      },
      topBoys,
      topGirls,
      liveFeed,
      lastSyncAt,
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    console.error("dashboard api error:", e);
    res.status(500).json({ error: "failed" });
  }
});

// آخر وقت تم فيه تحديث بيانات الصناديق من المنصة
router.get("/sync-status", async (req, res) => {
  try {
    const meta = await SyncMeta.findOne({ key: "funds" }).lean();
    res.json({ lastSyncAt: meta?.lastSyncAt || null });
  } catch (e) {
    res.json({ lastSyncAt: null });
  }
});

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
      "client_id currentTotal done",
    ).lean();

    const totalsByClient = new Map();
    const countByClient = new Map();
    const completedByClient = new Map();
    for (const f of fundsList) {
      const cid = Number(f.client_id);
      const amount = Number(f.currentTotal) || 0;
      totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
      if (amount > 0) {
        countByClient.set(cid, (countByClient.get(cid) || 0) + 1);
        if (f.done == "a") {
          completedByClient.set(cid, (completedByClient.get(cid) || 0) + 1);
        }
      }
    }

    const stats = entities.map((e) => {
      const ambs = ambassadors.filter(
        (a) => String(a.entity || "") === String(e.id),
      );
      let totalDonations = 0;
      let fundsCount = 0;
      let completedCount = 0;
      for (const a of ambs) {
        const cid = Number(a.platformProfileId);
        if (!Number.isFinite(cid)) continue;
        totalDonations += totalsByClient.get(cid) || 0;
        fundsCount += countByClient.get(cid) || 0;
        completedCount += completedByClient.get(cid) || 0;
      }
      return {
        id: e.id,
        name: e.name,
        ambassadorsCount: ambs.length,
        totalDonations,
        fundsCount,
        completedCount,
      };
    });

    res.json({ centers: stats });
  } catch (e) {
    res.status(500).json({ error: "failed" });
  }
});

function classifyEntity(e) {
  const id = String((e && e.id) || "");
  if (id === "330") return "ادارة";
  if (id === "550") return "خارج";
  const s = String((e && e.name) || "").trim();
  if (s.startsWith("مجمع")) return "مجمع";
  return "دار";
}

function kindLabelPlural(kind) {
  if (kind === "مجمع") return "المجمعات";
  if (kind === "دار") return "الدور النسائية";
  if (kind === "ادارة") return "الإدارة";
  if (kind === "خارج") return "من خارج الجمعية";
  return "";
}

// بيانات لوحة الشرف لجهة محددة — للعرض على شاشات الجهات
router.get("/public/centers/:id/board", async (req, res) => {
  try {
    const id = String(req.params.id);
    const entities = listEntities();
    const ambassadors = await Ambassador.find(
      {},
      "name entity platformProfileId",
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

    const centersStats = entities.map((e) => {
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
        kind: classifyEntity(e),
        ambassadorsCount: ambs.length,
        totalDonations,
        fundsCount,
      };
    });

    const current = centersStats.find((c) => String(c.id) === id);
    if (!current) return res.status(404).json({ error: "not_found" });

    const sameKind = centersStats
      .filter((c) => c.kind === current.kind)
      .sort((a, b) => b.totalDonations - a.totalDonations);

    const rankPosition =
      sameKind.findIndex((c) => String(c.id) === id) + 1;

    const topCenters = sameKind.slice(0, 3).map((c, i) => ({
      rank: i + 1,
      id: c.id,
      name: c.name,
      totalDonations: c.totalDonations,
      ambassadorsCount: c.ambassadorsCount,
      fundsCount: c.fundsCount,
      isCurrent: String(c.id) === id,
    }));

    const sameKindEntityIds = new Set(sameKind.map((c) => String(c.id)));
    const ambassadorsByEntity = new Map();
    for (const e of centersStats) ambassadorsByEntity.set(String(e.id), e.name);

    const ambassadorStats = ambassadors
      .filter((a) => sameKindEntityIds.has(String(a.entity || "")))
      .map((a) => {
        const cid = Number(a.platformProfileId);
        const total = Number.isFinite(cid) ? totalsByClient.get(cid) || 0 : 0;
        const count = Number.isFinite(cid) ? countByClient.get(cid) || 0 : 0;
        return {
          id: String(a._id),
          name: a.name,
          entityId: a.entity,
          entityName: ambassadorsByEntity.get(String(a.entity || "")) || "",
          totalDonations: total,
          fundsCount: count,
        };
      });
    ambassadorStats.sort((a, b) => b.totalDonations - a.totalDonations);

    const topAmbassadors = ambassadorStats.slice(0, 3).map((a, i) => ({
      rank: i + 1,
      id: a.id,
      name: a.name,
      entityId: a.entityId,
      entityName: a.entityName,
      fundsCount: a.fundsCount,
      isCurrentEntity: String(a.entityId || "") === id,
    }));

    const myAmbassadors = ambassadors
      .filter((a) => String(a.entity || "") === id)
      .map((a) => {
        const cid = Number(a.platformProfileId);
        const total = Number.isFinite(cid) ? totalsByClient.get(cid) || 0 : 0;
        const count = Number.isFinite(cid) ? countByClient.get(cid) || 0 : 0;
        return {
          id: String(a._id),
          name: a.name,
          totalDonations: total,
          fundsCount: count,
        };
      });
    myAmbassadors.sort((a, b) => b.totalDonations - a.totalDonations);

    res.json({
      center: {
        id: current.id,
        name: current.name,
        kind: current.kind,
        kindLabel: kindLabelPlural(current.kind),
        ambassadorsCount: current.ambassadorsCount,
        fundsCount: current.fundsCount,
        totalDonations: current.totalDonations,
      },
      rank: {
        position: rankPosition,
        total: sameKind.length,
        kindLabel: kindLabelPlural(current.kind),
      },
      topCenters,
      topAmbassadors,
      ambassadors: myAmbassadors,
      control: boardControl.getState(),
    });
  } catch (e) {
    console.error("board api error:", e);
    res.status(500).json({ error: "failed" });
  }
});

// نقطة خفيفة جداً — تستخدمها صفحة لوحة الشرف للتحقق من حالة التحكم بشكل دوري دون استدعاء الـ board الكامل
router.get("/public/board-control", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(boardControl.getState());
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
      "client_id currentTotal done",
    ).lean();

    const totalsByClient = new Map();
    const countByClient = new Map();
    const completedByClient = new Map();
    for (const f of fundsList) {
      const cid = Number(f.client_id);
      const amount = Number(f.currentTotal) || 0;
      totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
      if (amount > 0) {
        countByClient.set(cid, (countByClient.get(cid) || 0) + 1);
        if (f.done == "a") {
          completedByClient.set(cid, (completedByClient.get(cid) || 0) + 1);
        }
      }
    }

    const list = ambassadors.map((a) => {
      const cid = Number(a.platformProfileId);
      const total = Number.isFinite(cid) ? totalsByClient.get(cid) || 0 : 0;
      const count = Number.isFinite(cid) ? countByClient.get(cid) || 0 : 0;
      const completed = Number.isFinite(cid) ? completedByClient.get(cid) || 0 : 0;
      return {
        id: String(a._id),
        name: a.name,
        phone: a.phone,
        totalDonations: total,
        fundsCount: count,
        completedFunds: completed,
        donationsUpdatedAt: a.donationsUpdatedAt,
      };
    });
    list.sort((a, b) => b.totalDonations - a.totalDonations);

    const totalDonations = list.reduce((s, a) => s + a.totalDonations, 0);
    const fundsCount = list.reduce((s, a) => s + a.fundsCount, 0);
    const completedFunds = list.reduce((s, a) => s + a.completedFunds, 0);

    res.json({
      center: {
        id,
        name: entityName(id),
        ambassadorsCount: list.length,
        fundsCount,
        totalDonations,
        completedFunds,
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

// ===== Out API — للربط مع الجهات الخارجية =====
// يتطلب مفتاح ربط في الهيدر: x-api-key
function requireOutApiKey(req, res, next) {
  const provided = req.headers["x-api-key"];
  const expected = process.env.OUT_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: "out_api_key_not_configured" });
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

router.get("/out/ambassadors", requireOutApiKey, async (req, res) => {
  try {
    const ambassadors = await Ambassador.find(
      {},
      "name phone platformProfileId",
    ).lean();
    const data = ambassadors.map((a) => ({
      name: a.name,
      phone: a.phone,
      client_id: a.platformProfileId,
    }));
    res.json({ count: data.length, users: data });
  } catch (e) {
    console.error("out ambassadors error:", e);
    res.status(500).json({ error: "failed" });
  }
});

router.get("/out/boxes", requireOutApiKey, async (req, res) => {
  try {
    const funds = await AllFund.find(
      {},
      "name client_id id price_goal total done",
    ).lean();
    const data = funds.map((f) => ({
      name: f.name,
      client_id: f.client_id,
      id: f.id,
      price_goal: f.price_goal,
      total: f.total,
      done: f.done,
    }));
    res.json({ count: data.length, users: data });
  } catch (e) {
    console.error("out funds error:", e);
    res.status(500).json({ error: "failed" });
  }
});

module.exports = router;

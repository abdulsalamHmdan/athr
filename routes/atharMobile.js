const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Ambassador = require("../models/Ambassador");
const BonusPoints = require("../models/BonusPoints");
const PrizeRequest = require("../models/PrizeRequest");
const {
  M,
  fail,
  integer,
  text,
  settings,
  lockAmbassador,
  balance,
  redeem,
  receipt,
  phase,
} = require("../services/atharCore");
const {
  dashboard,
  boxDTO,
  missionDTO,
  iso,
} = require("../services/atharDashboard");
const router = express.Router();
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const id = (value) => {
  if (!mongoose.isValidObjectId(value)) fail(404, "العنصر غير موجود");
  return value;
};
const requestKey = (req) => text(req.get("Idempotency-Key"), 16, 120);
async function rate(key, limit, seconds) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  let row;
  try {
    row = await M.Rate.findOneAndUpdate(
      { key: `${key}:${bucket}` },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((bucket + 2) * seconds * 1000) },
      },
      { upsert: true, new: true },
    );
  } catch (e) {
    if (e.code === 11000) fail(429, "طلبات كثيرة، حاول لاحقًا");
    throw e;
  }
  if (row.count > limit) fail(429, "طلبات كثيرة، حاول لاحقًا");
}
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get(
  "/config",
  wrap(async (req, res) => {
    const c = await settings();
    res.json({
      enabled: c.enabled,
      storeEnabled: c.storeEnabled,
      boxesEnabled: c.boxesEnabled,
      competitionsEnabled: c.competitionsEnabled,
      missionsEnabled: c.missionsEnabled,
      gameEnabled: c.gameEnabled,
      maintenanceMessage: c.maintenanceMessage,
      supportURL: c.supportURL,
      privacyURL: c.privacyURL,
      termsURL: c.termsURL,
    });
  }),
);
router.post(
  "/auth/login",
  wrap(async (req, res) => {
    await rate(`login:${hash(req.ip)}`, 20, 900);
    let phone = text(req.body.phone, 9, 16)
      .replace(/^\+?966/, "")
      .replace(/^0/, "");
    if (!/^5\d{8}$/.test(phone)) fail(422, "رقم الجوال غير صحيح");
    await rate(`phone:${hash(phone)}`, 10, 900);
    const password = text(req.body.password, 1, 200);
    const amb = await Ambassador.findOne({ phone });
    if (!amb || !(await bcrypt.compare(password, amb.password)))
      fail(401, "بيانات الدخول غير صحيحة");
    if (amb.appSuspended) fail(403, "الحساب موقوف");
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await M.Session.create({
      ambassador: amb._id,
      tokenHash: hash(token),
      passwordHash: amb.password,
      expiresAt,
    });
    res.json({ accessToken: token, expiresAt: iso(expiresAt) });
  }),
);
router.use(
  wrap(async (req, res, next) => {
    const token = String(req.get("Authorization") || "").match(
      /^Bearer ([A-Za-z0-9_-]{43})$/,
    )?.[1];
    if (!token) fail(401, "سجّل الدخول للمتابعة");
    const session = await M.Session.findOne({
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    });
    if (!session) fail(401, "انتهت جلسة الدخول");
    const amb = await Ambassador.findById(session.ambassador);
    if (!amb || amb.password !== session.passwordHash)
      fail(401, "سجّل الدخول مجددًا");
    if (amb.appSuspended) fail(403, "الحساب موقوف");
    req.amb = amb;
    req.mobileSession = session;
    await rate(`api:${amb._id}`, 180, 60);
    next();
  }),
);
router.post(
  "/auth/logout",
  wrap(async (req, res) => {
    await req.mobileSession.deleteOne();
    res.json({});
  }),
);
router.use(
  wrap(async (req, res, next) => {
    const c = await settings();
    if (!c.enabled) fail(503, c.maintenanceMessage);
    req.cfg = c;
    next();
  }),
);
router.get(
  "/ambassador/dashboard",
  wrap(async (req, res) => res.json(await dashboard(req.amb))),
);
router.get(
  "/ambassador/store/orders",
  wrap(async (req, res) => {
    const available = (await balance(req.amb)).available;
    res.json(
      await PrizeRequest.find({ ambassador: req.amb._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .then((rows) => rows.map((r) => receipt(r, available))),
    );
  }),
);
router.post(
  "/ambassador/store/redemptions",
  wrap(async (req, res) => {
    const result = await redeem({
      ambassadorID: req.amb._id,
      productID: text(req.body.productID, 1, 60),
      key: requestKey(req),
      shippingAddress: text(req.body.shippingAddress || "", 0, 1000),
      mobile: true,
    });
    res.json(result.receipt);
  }),
);
router.post(
  "/ambassador/boxes",
  wrap(async (req, res) => {
    if (!req.cfg.boxesEnabled) fail(403, "إنشاء الصناديق غير متاح");
    const key = requestKey(req),
      deceasedName = text(req.body.deceasedName, 2, 100),
      title = text(req.body.title, 2, 200),
      target = integer(req.body.target, 1, 10000000);
    const box = await mongoose.connection.transaction(async (session) => {
      await lockAmbassador(req.amb._id, session);
      const previous = await M.Box.findOne({
        ambassador: req.amb._id,
        key,
      }).session(session);
      if (previous) {
        if (
          previous.title !== title ||
          previous.target !== target ||
          previous.deceasedName !== deceasedName
        )
          fail(409, "مفتاح الطلب مستخدم");
        return previous;
      }
      const count = await M.Box.countDocuments({
        ambassador: req.amb._id,
        createdAt: { $gte: new Date(Date.now() - 86400000) },
      }).session(session);
      if (count >= req.cfg.maxBoxesPerDay)
        fail(429, "وصلت إلى الحد اليومي للصناديق");
      return (
        await M.Box.create(
          [{ ambassador: req.amb._id, key, deceasedName, title, target }],
          { session },
        )
      )[0];
    });
    res.json(boxDTO(box, req.cfg));
  }),
);
router.post(
  "/ambassador/events/share",
  wrap(async (req, res) => {
    const key = requestKey(req),
      resourceID = req.body.resourceID ? text(req.body.resourceID, 1, 100) : "";
    if (resourceID) {
      const d = await dashboard(req.amb);
      const box = d.boxes.find((b) => b.id === resourceID);
      if (!box || box.state !== "active")
        fail(403, "الصندوق غير متاح للمشاركة");
    }
    await mongoose.connection.transaction(async (session) => {
      await lockAmbassador(req.amb._id, session);
      if (
        await M.Event.exists({ ambassador: req.amb._id, key }).session(session)
      )
        return;
      await M.Event.create(
        [{ ambassador: req.amb._id, key, type: "share", resourceID }],
        { session },
      );
      await M.Player.updateOne(
        { ambassador: req.amb._id },
        { $inc: { shares: 1 } },
        { upsert: true, session },
      );
    });
    res.json({});
  }),
);
router.post(
  "/ambassador/game/completions",
  wrap(async (req, res) => {
    if (!req.cfg.gameEnabled) fail(403, "التدريب غير متاح");
    const level = integer(req.body.level, 1, 12),
      stars = integer(req.body.stars, 1, 3);
    integer(req.body.elapsedSeconds, 1, 86400);
    await mongoose.connection.transaction(async (session) => {
      await lockAmbassador(req.amb._id, session);
      let p = await M.Player.findOne({ ambassador: req.amb._id }).session(
        session,
      );
      if (!p) p = new M.Player({ ambassador: req.amb._id });
      const completed = [...p.bestStars.keys()].map(Number);
      if (level > Math.min(12, Math.max(0, ...completed) + 1))
        fail(409, "أكمل المرحلة السابقة");
      const previous = p.bestStars.get(String(level)) || 0;
      if (stars > previous) {
        p.bestStars.set(String(level), stars);
        p.seeds += (stars - previous) * 12;
      }
      await p.save({ session });
    });
    res.json({});
  }),
);
router.post(
  "/ambassador/missions/claim",
  wrap(async (req, res) => {
    if (!req.cfg.missionsEnabled) fail(403, "المهام غير متاحة");
    const missionID = id(req.body.missionID);
    const result = await mongoose.connection.transaction(async (session) => {
      const amb = await lockAmbassador(req.amb._id, session);
      const old = await M.Claim.findOne({
        ambassador: amb._id,
        mission: missionID,
      }).session(session);
      if (old) return old.receipt;
      const m = await M.Mission.findOne({
        _id: missionID,
        active: true,
        startsAt: { $lte: new Date() },
        endsAt: { $gt: new Date() },
      }).session(session);
      if (!m) fail(404, "المهمة غير متاحة");
      const dto = await missionDTO(m, amb, session);
      if (dto.state !== "completed") fail(409, "لم تكتمل المهمة");
      dto.state = "claimed";
      if (m.rewardPointBonus > 0)
        await BonusPoints.create(
          [
            {
              ambassador: amb._id,
              amount: m.rewardPointBonus,
              reason: m.title,
              source: "mission",
              reference: `mission:${m._id}`,
            },
          ],
          { session },
        );
      await M.Player.updateOne(
        { ambassador: amb._id },
        { $inc: { seeds: m.seedReward } },
        { upsert: true, session },
      );
      await M.Claim.create(
        [{ ambassador: amb._id, mission: missionID, receipt: dto }],
        { session },
      );
      return dto;
    });
    res.json(result);
  }),
);
router.use(
  "/competitions",
  wrap(async (req, res, next) => {
    if (!req.cfg.competitionsEnabled) fail(403, "المسابقات غير متاحة");
    next();
  }),
);
router.get(
  "/competitions/upcoming",
  wrap(async (req, res) => {
    const rows = await M.Competition.find({
      state: { $in: ["scheduled", "live", "paused", "published"] },
    })
      .sort({ scheduledAt: -1 })
      .limit(20)
      .lean();
    res.json(
      rows.map((c) => ({
        id: String(c._id),
        title: c.title,
        scheduledAt: iso(c.scheduledAt),
        rewardPool: c.rewardPool,
        questionCount: c.questions.length,
        durationSeconds: c.durationSeconds,
        eligibilityPercent: c.eligibilityPercent,
        state: c.state,
      })),
    );
  }),
);
router.post(
  "/competitions/:id/join",
  wrap(async (req, res) => {
    const cid = id(req.params.id);
    await mongoose.connection.transaction(async (session) => {
      const c = await M.Competition.findOneAndUpdate(
        { _id: cid, state: { $in: ["scheduled", "live"] } },
        { $inc: { revision: 1 } },
        { new: true, session },
      );
      if (!c) fail(409, "المسابقة غير مفتوحة للانضمام");
      const old = await M.Participant.findOne({
        competition: cid,
        ambassador: req.amb._id,
      }).session(session);
      if (old) return;
      const p = phase(c);
      if (p.state === "calculating" || (p.index || 0) > 0)
        fail(409, "أُغلق الانضمام بعد السؤال الأول");
      await M.Participant.create(
        [{ competition: cid, ambassador: req.amb._id, name: req.amb.name }],
        { session },
      );
    });
    res.json({});
  }),
);
router.get(
  "/competitions/:id/snapshot",
  wrap(async (req, res) => {
    const cid = id(req.params.id),
      c = await M.Competition.findById(cid).lean();
    if (!c || ["draft", "archived"].includes(c.state))
      fail(404, "المسابقة غير متاحة");
    const now = new Date(),
      p = phase(c, now),
      participant = await M.Participant.findOne({
        competition: cid,
        ambassador: req.amb._id,
      });
    let question = null;
    if (participant && p.index !== undefined) {
      const q = c.questions[p.index];
      const answer = await M.Answer.findOne({
        competition: cid,
        question: String(q._id),
        ambassador: req.amb._id,
      }).lean();
      question = {
        id: String(q._id),
        index: p.index + 1,
        text: q.text,
        choices: q.choices,
        closesAt: iso(p.closesAt),
        answered: !!answer,
        selectedChoice: answer?.choiceID ?? null,
      };
      if (p.state === "reveal")
        Object.assign(question, {
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          reference: q.reference,
          score: answer?.score || 0,
        });
    }
    // Aggregate only CLOSED questions so scores never disclose correctness while open.
    const closed = c.questions
      .filter(
        (q, i) =>
          c.startedAt &&
          +new Date(c.startedAt) +
            (i * (c.durationSeconds + c.revealSeconds) + c.durationSeconds) *
              1000 <=
            +(c.state === "paused" ? new Date(c.pausedAt) : now),
      )
      .map((q) => String(q._id));
    const scores = await M.Answer.aggregate([
      { $match: { competition: cid, question: { $in: closed } } },
      { $group: { _id: "$ambassador", score: { $sum: "$score" } } },
      { $sort: { score: -1, _id: 1 } },
    ]);
    const people = await M.Participant.find({ competition: cid }).lean();
    const leaderboard = scores
      .slice(0, 10)
      .map((s, i) => ({
        id: String(s._id),
        name:
          people.find((a) => String(a.ambassador) === String(s._id))?.name ||
          "سفير",
        score: s.score,
        rank: i + 1,
      }));
    const me =
      c.state === "published"
        ? c.results.find((r) => r.ambassador === String(req.amb._id))
        : null;
    const claimed = !!(await BonusPoints.exists({
      ambassador: req.amb._id,
      reference: `competition:${cid}`,
    }));
    res.json({
      id: cid,
      title: c.title,
      state: p.state,
      serverTime: iso(now),
      joined: !!participant,
      participantCount: people.length,
      questionCount: c.questions.length,
      question,
      leaderboard,
      rewardPoints: me?.points || 0,
      rank: me?.rank || 0,
      claimed,
    });
  }),
);
router.post(
  "/competitions/:id/questions/:questionID/answers",
  wrap(async (req, res) => {
    const cid = id(req.params.id),
      qid = id(req.params.questionID),
      choiceID = integer(req.body.choiceID, 0, 3);
    // Capture arrival time at the server; never use the phone's clock to score.
    const receivedAt = new Date();
    await mongoose.connection.transaction(async (session) => {
      const c = await M.Competition.findOneAndUpdate(
        { _id: cid, state: "live" },
        { $inc: { revision: 1 } },
        { new: true, session },
      );
      if (!c) fail(409, "المسابقة ليست في وضع استقبال الإجابات");
      if (
        !(await M.Participant.exists({
          competition: cid,
          ambassador: req.amb._id,
        }).session(session))
      )
        fail(403, "انضم للمسابقة أولًا");
      if (
        await M.Answer.exists({
          competition: cid,
          question: qid,
          ambassador: req.amb._id,
        }).session(session)
      )
        return;
      const p = phase(c, receivedAt),
        q = c.questions[p.index];
      if (p.state !== "question" || String(q?._id) !== qid)
        fail(409, "انتهى وقت السؤال");
      const elapsed = receivedAt - p.openedAt;
      const score =
        choiceID === q.correctIndex
          ? 500 + Math.round(500 * (1 - elapsed / (c.durationSeconds * 1000)))
          : 0;
      await M.Answer.create(
        [
          {
            ambassador: req.amb._id,
            competition: cid,
            question: qid,
            choiceID,
            score,
            receivedAt,
            elapsedMilliseconds: elapsed,
          },
        ],
        { session },
      );
    });
    res.json({});
  }),
);
router.post(
  "/competitions/:id/rewards/claim",
  wrap(async (req, res) => {
    const cid = id(req.params.id);
    const result = await mongoose.connection.transaction(async (session) => {
      const amb = await lockAmbassador(req.amb._id, session);
      const c = await M.Competition.findOne({
        _id: cid,
        state: "published",
      }).session(session);
      const me = c?.results.find((r) => r.ambassador === String(amb._id));
      if (!me || me.points <= 0) fail(409, "لا توجد مكافأة مستحقة منشورة");
      let entry = await BonusPoints.findOne({
        ambassador: amb._id,
        reference: `competition:${cid}`,
      }).session(session);
      if (!entry)
        entry = (
          await BonusPoints.create(
            [
              {
                ambassador: amb._id,
                amount: me.points,
                reason: c.title,
                source: "competition",
                reference: `competition:${cid}`,
              },
            ],
            { session },
          )
        )[0];
      return {
        id: String(entry._id),
        points: entry.amount,
        remainingPoints: (await balance(amb, session)).available,
      };
    });
    res.json(result);
  }),
);
router.use((err, req, res, next) => {
  const status =
    err.status ||
    (err.name === "CastError" || err.name === "ValidationError"
      ? 422
      : err.code === 11000
        ? 409
        : 500);
  if (status === 500)
    console.error("[athar] request failed:", err.name, err.code || "");
  res
    .status(status)
    .json({
      message:
        status === 500
          ? "تعذّر إتمام العملية الآن"
          : err.status
            ? err.message
            : status === 409
              ? "العملية مسجلة مسبقًا"
              : "البيانات غير صالحة",
    });
});
module.exports = { router, wrap, id };

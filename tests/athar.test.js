const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { M, allocate, phase } = require("../services/atharCore");
const Ambassador = require("../models/Ambassador");
const AllFund = require("../models/AllFund");
const Prize = require("../models/Prize");
const PrizeRequest = require("../models/PrizeRequest");
const Bonus = require("../models/BonusPoints");
let repl, app, amb, other, token, otherToken, admin, csrf, competition;
const key = () => crypto.randomUUID();
const mobile = (method, path, body, idem = key(), auth = token) =>
  request(app)
    [method]("/v1" + path)
    .set("Authorization", "Bearer " + auth)
    .set("Idempotency-Key", idem)
    .send(body);
const adminPost = (path, body) =>
  admin
    .post("/admin/athar" + path)
    .set("X-CSRF-Token", csrf)
    .send(body);
const fs = require("fs");
const path = require("path");
const fixture = (name, data) => {
  fs.mkdirSync(path.join(__dirname, "../output/contracts"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(__dirname, "../output/contracts", name + ".json"),
    JSON.stringify(data),
  );
};
const questions = [
  {
    text: "سؤال اختباري معتمد",
    choices: ["أ", "ب", "ج", "د"],
    correctIndex: 2,
    explanation: "شرح اختباري",
    reference: "مرجع الاختبار",
    approved: true,
  },
];
before(async () => {
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(repl.getUri());
  app = express();
  app.use(express.json());
  app.use(
    session({
      secret: crypto.randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.set("view engine", "ejs");
  app.set("views", require("path").join(__dirname, "../views"));
  // Test-only local session setup; this handler is never mounted in production.
  app.get("/test-admin", (req, res) => {
    req.session.adminId = new mongoose.Types.ObjectId().toString();
    res.json({});
  });
  app.get("/test-web", (req, res) => {
    req.session.ambassadorId = String(amb._id);
    res.json({});
  });
  app.use("/ambassador", require("../routes/ambassador"));
  app.use("/admin", require("../routes/admin"));
  app.use("/v1", require("../routes/atharMobile").router);
  app.use("/admin/athar", require("../routes/atharAdmin"));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const password = await bcrypt.hash("test-password", 4);
  amb = await Ambassador.create({
    name: "سفير الاختبار",
    phone: "500000001",
    password,
    referralCode: "test-a",
    platformProfileId: "123",
  });
  other = await Ambassador.create({
    name: "سفير آخر",
    phone: "500000002",
    password,
    referralCode: "test-b",
    platformProfileId: "124",
  });
  await AllFund.create({
    id: 999,
    client_id: 123,
    currentTotal: 2000,
    price_goal: 5000,
    name: "صندوق موثوق",
    orderCount: 3,
  });
  await M.Settings.create({
    key: "app",
    enabled: true,
    storeEnabled: true,
    boxesEnabled: true,
    competitionsEnabled: true,
    missionsEnabled: true,
  });
  token = (
    await request(app)
      .post("/v1/auth/login")
      .send({ phone: "0500000001", password: "test-password" })
      .expect(200)
  ).body.accessToken;
  otherToken = (
    await request(app)
      .post("/v1/auth/login")
      .send({ phone: "500000002", password: "test-password" })
      .expect(200)
  ).body.accessToken;
  admin = request.agent(app);
  await admin.get("/test-admin");
  const page = await admin.get("/admin/athar/").expect(200);
  csrf = page.text.match(/data-csrf="([^"]+)"/)[1];
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});
test("allocation conserves pool, is deterministic, and excludes ineligible participants", () => {
  const rows = [
    { ambassador: "c", score: 1, answered: 7 },
    { ambassador: "a", score: 1, answered: 7 },
    { ambassador: "b", score: 1, answered: 7 },
    { ambassador: "d", score: 100, answered: 1 },
  ];
  const out = allocate(10, rows, 10, 70);
  assert.equal(
    out.reduce((s, r) => s + r.points, 0),
    10,
  );
  assert.equal(out.find((r) => r.ambassador === "a").points, 4);
  assert.equal(out.find((r) => r.ambassador === "d").points, 0);
  assert.deepEqual(out, allocate(10, [...rows].reverse(), 10, 70));
  assert.deepEqual(allocate(100, [], 10, 70), []);
  assert.equal(
    allocate(100, [{ ambassador: "a", score: 0, answered: 10 }], 10, 70)[0]
      .points,
    0,
  );
});
test("dashboard requires bearer token and isolates account data", async () => {
  await request(app).get("/v1/ambassador/dashboard").expect(401);
  const d = (await mobile("get", "/ambassador/dashboard").expect(200)).body;
  fixture("dashboard", d);
  assert.equal(d.profile.rewardPoints, 2000);
  assert.equal(d.boxes[0].id, "fund-999");
  assert.equal(d.impact.totalRaised, 2000);
  const d2 = (
    await mobile(
      "get",
      "/ambassador/dashboard",
      undefined,
      key(),
      otherToken,
    ).expect(200)
  ).body;
  assert.equal(d2.boxes.length, 0);
  assert.equal(d2.profile.rewardPoints, 0);
  assert.equal(d.profile.password, undefined);
});
test("admin settings require both admin session and CSRF", async () => {
  await request(app)
    .get("/admin/athar/data")
    .set("Accept", "application/json")
    .expect(401);
  await admin
    .post("/admin/athar/settings")
    .send({ enabled: false })
    .expect(403);
  const cfg = (await admin.get("/admin/athar/data")).body.config;
  await adminPost("/settings", {
    ...cfg,
    privacyURL: "https://example.org/privacy",
    termsURL: "https://example.org/terms",
  }).expect(200);
  await adminPost("/settings", {
    ...cfg,
    generalShareURL: "javascript:alert(1)",
  }).expect(422);
});
test("concurrent purchase retries create exactly one reservation and debit", async () => {
  await Prize.create({
    key: "cup",
    name: "كوب",
    tier: "bronze",
    stock: 2,
    pointCost: 700,
    requiresShipping: true,
  });
  const idem = key();
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      mobile(
        "post",
        "/ambassador/store/redemptions",
        { productID: "cup", shippingAddress: "الرياض، حي الاختبار، مبنى 1" },
        idem,
      ),
    ),
  );
  assert.ok(
    responses.every((r) => r.status === 200),
    responses.map((r) => r.status).join(","),
  );
  assert.equal(new Set(responses.map((r) => r.body.id)).size, 1);
  assert.equal(await PrizeRequest.countDocuments(), 1);
  assert.equal(
    (await mobile("get", "/ambassador/dashboard")).body.profile.rewardPoints,
    1300,
  );
  await mobile(
    "post",
    "/ambassador/store/redemptions",
    { productID: "cup", shippingAddress: "عنوان مختلف" },
    idem,
  ).expect(409);
});
test("concurrent different orders cannot overspend shared balance", async () => {
  await Prize.create({
    key: "book",
    name: "كتاب",
    tier: "bronze",
    stock: 10,
    pointCost: 800,
    requiresShipping: false,
  });
  const out = await Promise.all([
    mobile("post", "/ambassador/store/redemptions", { productID: "book" }),
    mobile("post", "/ambassador/store/redemptions", { productID: "book" }),
  ]);
  assert.deepEqual(out.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await mobile("get", "/ambassador/dashboard")).body.profile.rewardPoints,
    500,
  );
});
test("stock is reserved atomically across different ambassadors", async () => {
  await Bonus.create({ ambassador: other._id, amount: 1000, source: "admin" });
  await Prize.create({
    key: "last",
    name: "آخر قطعة",
    tier: "bronze",
    stock: 1,
    pointCost: 300,
    requiresShipping: false,
  });
  const out = await Promise.all([
    mobile("post", "/ambassador/store/redemptions", { productID: "last" }),
    mobile(
      "post",
      "/ambassador/store/redemptions",
      { productID: "last" },
      key(),
      otherToken,
    ),
  ]);
  assert.deepEqual(out.map((r) => r.status).sort(), [200, 409]);
  assert.equal(await PrizeRequest.countDocuments({ prizeId: "last" }), 1);
});
test("rejection refunds once and cannot be reopened; delivery is terminal", async () => {
  const order = await PrizeRequest.findOne({ prizeId: "cup" });
  const before = (await mobile("get", "/ambassador/dashboard")).body.profile
    .rewardPoints;
  await adminPost("/orders/" + order._id, {
    status: "rejected",
    note: "إلغاء تجريبي",
  }).expect(200);
  await adminPost("/orders/" + order._id, {
    status: "rejected",
    note: "",
  }).expect(200);
  assert.equal(
    (await mobile("get", "/ambassador/dashboard")).body.profile.rewardPoints,
    before + 700,
  );
  await adminPost("/orders/" + order._id, { status: "approved" }).expect(409);
  const book = await PrizeRequest.findOne({ prizeId: "book" });
  await adminPost("/orders/" + book._id, { status: "approved" }).expect(200);
  await adminPost("/orders/" + book._id, { status: "paid" }).expect(200);
  await adminPost("/orders/" + book._id, { status: "rejected" }).expect(409);
});
test("store validates address, product and feature switches", async () => {
  await mobile("post", "/ambassador/store/redemptions", {
    productID: "cup",
  }).expect(422);
  await mobile("post", "/ambassador/store/redemptions", {
    productID: "missing",
  }).expect(409);
  await M.Settings.updateOne({ key: "app" }, { $set: { storeEnabled: false } });
  await mobile("post", "/ambassador/store/redemptions", {
    productID: "cup",
    shippingAddress: "عنوان",
  }).expect(403);
  await M.Settings.updateOne({ key: "app" }, { $set: { storeEnabled: true } });
});
test("boxes are pending, idempotent, private, and linked only to owned synchronized funds", async () => {
  const body = { deceasedName: "محمد", title: "صدقة عن محمد", target: 3000 },
    idem = key();
  const box = (
    await mobile("post", "/ambassador/boxes", body, idem).expect(200)
  ).body;
  assert.equal(box.state, "pendingReview");
  assert.equal(
    (await mobile("post", "/ambassador/boxes", body, idem)).body.id,
    box.id,
  );
  await mobile("post", "/ambassador/events/share", {
    resourceID: box.id,
  }).expect(403);
  await adminPost("/boxes/" + box.id, {
    state: "active",
    externalId: 555,
  }).expect(422);
  await adminPost("/boxes/" + box.id, {
    state: "active",
    externalId: 999,
  }).expect(200);
  await mobile(
    "post",
    "/ambassador/events/share",
    { resourceID: box.id },
    key(),
    otherToken,
  ).expect(403);
  await mobile("post", "/ambassador/events/share", {
    resourceID: box.id,
  }).expect(200);
});
test("share and training never grant store points; missions cannot trust client progress", async () => {
  const before = (await mobile("get", "/ambassador/dashboard")).body.profile
    .rewardPoints;
  const idem = key();
  await mobile(
    "post",
    "/ambassador/events/share",
    { resourceID: null },
    idem,
  ).expect(200);
  await mobile(
    "post",
    "/ambassador/events/share",
    { resourceID: null },
    idem,
  ).expect(200);
  await mobile("post", "/ambassador/game/completions", {
    level: 12,
    stars: 3,
    elapsedSeconds: 10,
  }).expect(409);
  await mobile("post", "/ambassador/game/completions", {
    level: 1,
    stars: 3,
    elapsedSeconds: 20,
  }).expect(200);
  await mobile("post", "/ambassador/game/completions", {
    level: 1,
    stars: 3,
    elapsedSeconds: 20,
  }).expect(200);
  const d = (await mobile("get", "/ambassador/dashboard")).body;
  assert.equal(d.profile.rewardPoints, before);
  assert.equal(d.profile.gameSeeds, 36);
  assert.deepEqual(d.gameProgress.completedLevels, [1]);
  const m = await M.Mission.create({
    title: "مشاركة",
    detail: "ثلاث مشاركات",
    kind: "shareGeneralLink",
    target: 3,
    seedReward: 20,
    rewardPointBonus: 0,
    active: true,
    startsAt: new Date(Date.now() - 10000),
    endsAt: new Date(Date.now() + 3600000),
  });
  await mobile("post", "/ambassador/missions/claim", {
    missionID: String(m._id),
    progress: 999,
  }).expect(409);
  for (let i = 0; i < 2; i++)
    await mobile("post", "/ambassador/events/share", {}).expect(200);
  const out = await Promise.all([
    mobile("post", "/ambassador/missions/claim", { missionID: String(m._id) }),
    mobile("post", "/ambassador/missions/claim", { missionID: String(m._id) }),
  ]);
  assert.ok(out.every((r) => r.status === 200));
  assert.equal(
    (await mobile("get", "/ambassador/dashboard")).body.profile.gameSeeds,
    56,
  );
  await adminPost("/missions", {
    title: "تحايل",
    detail: "اختبار",
    kind: "playPuzzle",
    target: 1,
    seedReward: 1,
    rewardPointBonus: 999,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 10000),
  }).expect(422);
});
test("competition scheduling requires approval and freezes rules", async () => {
  const data = {
    title: "مسابقة اختبار",
    scheduledAt: new Date(Date.now() + 60000),
    rewardPool: 101,
    durationSeconds: 12,
    revealSeconds: 5,
    eligibilityPercent: 70,
    questions: questions.map((q) => ({ ...q, approved: false })),
  };
  await adminPost("/competitions", data).expect(200);
  competition = await M.Competition.findOne({ title: data.title });
  await adminPost("/competitions/" + competition._id + "/action", {
    action: "schedule",
  }).expect(409);
  await adminPost("/competitions", {
    ...data,
    id: String(competition._id),
    questions,
  }).expect(200);
  await adminPost("/competitions/" + competition._id + "/action", {
    action: "schedule",
  }).expect(200);
  await adminPost("/competitions", {
    ...data,
    id: String(competition._id),
  }).expect(409);
  await adminPost("/competitions/" + competition._id + "/action", {
    action: "start",
  }).expect(409);
});
test("live question hides answers; only first server-timed answer scores", async () => {
  const cid = String(competition._id);
  await mobile("post", "/competitions/" + cid + "/join", {}).expect(200);
  await mobile(
    "post",
    "/competitions/" + cid + "/join",
    {},
    key(),
    otherToken,
  ).expect(200);
  await M.Competition.updateOne(
    { _id: cid },
    { $set: { scheduledAt: new Date(Date.now() - 1000) } },
  );
  await adminPost("/competitions/" + cid + "/action", {
    action: "start",
  }).expect(200);
  let snap = (
    await mobile("get", "/competitions/" + cid + "/snapshot").expect(200)
  ).body;
  fixture("question", snap);
  assert.equal(snap.state, "question");
  assert.equal(snap.question.correctIndex, undefined);
  assert.equal(snap.question.explanation, undefined);
  const qid = snap.question.id;
  await mobile("post", `/competitions/${cid}/questions/${qid}/answers`, {
    choiceID: 2,
    clientElapsedMilliseconds: -1000000,
  }).expect(200);
  await mobile("post", `/competitions/${cid}/questions/${qid}/answers`, {
    choiceID: 0,
  }).expect(200);
  snap = (await mobile("get", "/competitions/" + cid + "/snapshot")).body;
  assert.equal(snap.question.answered, true);
  assert.equal(snap.question.selectedChoice, 2);
  assert.equal(snap.question.score, undefined);
  assert.equal(snap.leaderboard.length, 0);
  const answer = await M.Answer.findOne({
    competition: cid,
    ambassador: amb._id,
  });
  assert.ok(answer.score <= 1000 && answer.score >= 500);
  await M.Competition.updateOne(
    { _id: cid },
    { $set: { startedAt: new Date(Date.now() - 13000) } },
  );
  await mobile(
    "post",
    `/competitions/${cid}/questions/${qid}/answers`,
    { choiceID: 2 },
    key(),
    otherToken,
  ).expect(409);
  snap = (await mobile("get", "/competitions/" + cid + "/snapshot")).body;
  fixture("reveal", snap);
  assert.equal(snap.state, "reveal");
  assert.equal(snap.question.correctIndex, 2);
  assert.equal(snap.leaderboard.length, 1);
});
test("reward publication waits for end; claiming is idempotent and shared with platform balance", async () => {
  const cid = String(competition._id);
  await adminPost("/competitions/" + cid + "/action", {
    action: "publish",
  }).expect(409);
  await mobile("post", "/competitions/" + cid + "/rewards/claim", {}).expect(
    409,
  );
  await M.Competition.updateOne(
    { _id: cid },
    { $set: { startedAt: new Date(Date.now() - 18000) } },
  );
  await adminPost("/competitions/" + cid + "/action", {
    action: "publish",
  }).expect(200);
  const before = (await mobile("get", "/ambassador/dashboard")).body.profile
    .rewardPoints;
  const out = await Promise.all(
    Array.from({ length: 4 }, () =>
      mobile("post", "/competitions/" + cid + "/rewards/claim", {}),
    ),
  );
  assert.ok(out.every((r) => r.status === 200));
  assert.equal(new Set(out.map((r) => r.body.id)).size, 1);
  assert.equal(
    (await mobile("get", "/ambassador/dashboard")).body.profile.rewardPoints,
    before + 101,
  );
  assert.equal(
    await Bonus.countDocuments({ reference: "competition:" + cid }),
    1,
  );
  await mobile(
    "post",
    "/competitions/" + cid + "/rewards/claim",
    {},
    key(),
    otherToken,
  ).expect(409);
  await adminPost("/competitions/" + cid + "/action", {
    action: "cancel",
  }).expect(409);
});
test("paused competitions do not reveal open question scores and reject submissions", async () => {
  const c = await M.Competition.create({
    title: "إيقاف",
    scheduledAt: new Date(),
    startedAt: new Date(),
    rewardPool: 10,
    durationSeconds: 12,
    revealSeconds: 5,
    eligibilityPercent: 70,
    state: "live",
    questions,
  });
  await mobile("post", `/competitions/${c._id}/join`, {}).expect(200);
  await mobile(
    "post",
    `/competitions/${c._id}/questions/${c.questions[0]._id}/answers`,
    { choiceID: 2 },
  ).expect(200);
  await adminPost(`/competitions/${c._id}/action`, { action: "pause" }).expect(
    200,
  );
  const snap = (await mobile("get", `/competitions/${c._id}/snapshot`)).body;
  assert.equal(snap.question, null);
  assert.equal(snap.leaderboard.length, 0);
  await mobile(
    "post",
    `/competitions/${c._id}/questions/${c.questions[0]._id}/answers`,
    { choiceID: 0 },
  ).expect(409);
  await adminPost(`/competitions/${c._id}/action`, { action: "resume" }).expect(
    200,
  );
});
test("legacy website and mobile share price, balance reservations and immutable rewards", async () => {
  const web = request.agent(app);
  await web.get("/test-web");
  await Prize.create({
    key: "web-item",
    name: "هدية موحدة",
    tier: "bronze",
    pointCost: 100,
    stock: 1,
    requiresShipping: false,
  });
  const idem = key();
  const r = await web
    .post("/ambassador/requests")
    .set("Idempotency-Key", idem)
    .send({ tier: "bronze", prizeId: "web-item" })
    .expect(200);
  assert.equal(r.body.request.amount, 100);
  const again = await web
    .post("/ambassador/requests")
    .set("Idempotency-Key", idem)
    .send({ tier: "bronze", prizeId: "web-item" })
    .expect(200);
  assert.equal(r.body.request._id, again.body.request._id);
  await mobile("post", "/ambassador/store/redemptions", {
    productID: "web-item",
  }).expect(409);
  const bonus = await Bonus.findOne({ source: "competition" });
  await admin.delete("/admin/bonus-points/entry/" + bonus._id).expect(404);
  assert.ok(await Bonus.exists({ _id: bonus._id }));
});
test("admin cannot publish draft, reduce reserved stock, or leak invalid question payloads", async () => {
  await adminPost("/competitions", {
    title: "غير صالح",
    scheduledAt: new Date(),
    rewardPool: 1,
    durationSeconds: 1,
    revealSeconds: 3,
    eligibilityPercent: 70,
    questions,
  }).expect(422);
  const p = await Prize.findOne({ key: "book" });
  await adminPost("/products", {
    key: p.key,
    name: p.name,
    description: "",
    tier: p.tier,
    stock: 0,
    pointCost: 800,
    active: true,
    requiresShipping: false,
  }).expect(409);
  await mobile("get", "/competitions/invalid/snapshot").expect(404);
  await M.Settings.updateOne({ key: "app" }, { $set: { enabled: false } });
  await mobile("get", "/ambassador/dashboard").expect(503);
  await request(app).get("/v1/config").expect(200);
  await M.Settings.updateOne({ key: "app" }, { $set: { enabled: true } });
});
test("logout revokes server token; password change invalidates all old sessions", async () => {
  await mobile("post", "/auth/logout", {}, key(), otherToken).expect(200);
  await mobile(
    "get",
    "/ambassador/dashboard",
    undefined,
    key(),
    otherToken,
  ).expect(401);
  await Ambassador.updateOne(
    { _id: amb._id },
    { $set: { password: await bcrypt.hash("new-password", 4) } },
  );
  await mobile("get", "/ambassador/dashboard").expect(401);
});

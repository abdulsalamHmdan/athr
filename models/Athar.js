const mongoose = require("mongoose");
const { Schema } = mongoose;
const objectId = {
  type: Schema.Types.ObjectId,
  ref: "Ambassador",
  required: true,
};
const model = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true });
  indexes.forEach(([keys, options]) => schema.index(keys, options));
  return mongoose.model(name, schema);
};
exports.Settings = model("AtharSettings", {
  key: { type: String, unique: true, default: "app" },
  enabled: { type: Boolean, default: false },
  storeEnabled: { type: Boolean, default: false },
  boxesEnabled: { type: Boolean, default: false },
  competitionsEnabled: { type: Boolean, default: false },
  missionsEnabled: { type: Boolean, default: false },
  gameEnabled: { type: Boolean, default: true },
  maintenanceMessage: {
    type: String,
    default: "يجري تجهيز تطبيق أثر، عد لاحقًا.",
  },
  generalShareURL: { type: String, default: "https://donate.utq.org.sa" },
  supportURL: { type: String, default: "https://sfeer.site" },
  privacyURL: { type: String, default: "" },
  termsURL: { type: String, default: "" },
  seasonTarget: { type: Number, default: 100000 },
  maxBoxesPerDay: { type: Number, default: 3 },
});
exports.Session = model(
  "AtharSession",
  {
    ambassador: objectId,
    tokenHash: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
exports.Player = model("AtharPlayer", {
  ambassador: { ...objectId, unique: true },
  seeds: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  bestStars: { type: Map, of: Number, default: {} },
});
exports.Event = model(
  "AtharEvent",
  { ambassador: objectId, key: String, type: String, resourceID: String },
  [[{ ambassador: 1, key: 1 }, { unique: true }]],
);
exports.Box = model(
  "AtharBox",
  {
    ambassador: objectId,
    key: String,
    deceasedName: String,
    title: String,
    target: Number,
    state: {
      type: String,
      enum: ["pendingReview", "active", "paused", "completed"],
      default: "pendingReview",
    },
    externalId: { type: Number, default: null },
    shareURL: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  [
    [{ ambassador: 1, key: 1 }, { unique: true }],
    [
      { externalId: 1 },
      {
        unique: true,
        partialFilterExpression: { externalId: { $type: "number" } },
      },
    ],
  ],
);
exports.Mission = model("AtharMission", {
  title: String,
  detail: String,
  kind: {
    type: String,
    enum: [
      "shareGeneralLink",
      "createMemorialBox",
      "firstBoxDonation",
      "weeklyImpact",
      "playPuzzle",
    ],
  },
  target: Number,
  seedReward: Number,
  rewardPointBonus: Number,
  active: { type: Boolean, default: false },
  startsAt: Date,
  endsAt: Date,
});
exports.Claim = model(
  "AtharClaim",
  { ambassador: objectId, mission: String, receipt: Schema.Types.Mixed },
  [[{ ambassador: 1, mission: 1 }, { unique: true }]],
);
const question = new Schema({
  text: String,
  choices: [String],
  correctIndex: Number,
  explanation: String,
  reference: String,
  approved: { type: Boolean, default: false },
});
exports.Competition = model("AtharCompetition", {
  title: String,
  scheduledAt: Date,
  rewardPool: Number,
  durationSeconds: Number,
  revealSeconds: { type: Number, default: 5 },
  eligibilityPercent: { type: Number, default: 70 },
  state: {
    type: String,
    enum: [
      "draft",
      "scheduled",
      "live",
      "paused",
      "published",
      "cancelled",
      "archived",
    ],
    default: "draft",
  },
  questions: [question],
  startedAt: Date,
  pausedAt: Date,
  revision: { type: Number, default: 0 },
  results: { type: [Schema.Types.Mixed], default: [] },
});
exports.Participant = model(
  "AtharParticipant",
  { ambassador: objectId, competition: String, name: String },
  [[{ competition: 1, ambassador: 1 }, { unique: true }]],
);
exports.Answer = model(
  "AtharAnswer",
  {
    ambassador: objectId,
    competition: String,
    question: String,
    choiceID: Number,
    score: Number,
    receivedAt: Date,
    elapsedMilliseconds: Number,
  },
  [[{ competition: 1, question: 1, ambassador: 1 }, { unique: true }]],
);
exports.Audit = model("AtharAudit", {
  admin: String,
  ambassador: String,
  action: String,
  reference: String,
  details: Schema.Types.Mixed,
});
exports.Rate = model(
  "AtharRate",
  { key: { type: String, unique: true }, count: Number, expiresAt: Date },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);

const { M, balance, settings, cost, ACTIVE_ORDERS } = require("./atharCore");
const Prize = require("../models/Prize");
const PrizeRequest = require("../models/PrizeRequest");
const AllFund = require("../models/AllFund");
function iso(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function boxDTO(box, cfg, fund) {
  const raised = Number(fund?.stats?.sold_total ?? fund?.currentTotal ?? 0);
  const target = Number(fund?.price_goal || box.target || 1);
  return {
    id: String(box._id),
    deceasedName: box.deceasedName || "",
    title: box.title || fund?.name || "",
    raised,
    target,
    donors: Number(fund?.orderCount || 0),
    shareURL: box.shareURL || cfg.generalShareURL,
    state: raised >= target ? "completed" : box.state,
    createdAt: iso(box.createdAt || new Date()),
  };
}
async function missionDTO(m, amb, session = null) {
  const claim = await M.Claim.findOne({
    ambassador: amb._id,
    mission: String(m._id),
  })
    .session(session)
    .lean();
  if (claim) return claim.receipt;
  const range = { $gte: m.startsAt, $lt: m.endsAt };
  let progress = 0;
  if (m.kind === "shareGeneralLink")
    progress = await M.Event.countDocuments({
      ambassador: amb._id,
      type: "share",
      resourceID: "",
      createdAt: range,
    }).session(session);
  if (m.kind === "createMemorialBox")
    progress = await M.Box.countDocuments({
      ambassador: amb._id,
      state: { $in: ["active", "completed"] },
      createdAt: range,
    }).session(session);
  if (m.kind === "playPuzzle") {
    const player = await M.Player.findOne({ ambassador: amb._id })
      .session(session)
      .lean();
    progress = Object.keys(player?.bestStars || {}).length;
  }
  // Donation missions use verified, synchronized funds attributed to this account.
  if (["weeklyImpact", "firstBoxDonation"].includes(m.kind)) {
    const { funds } = await balance(amb, session);
    const eligible = funds.filter(
      (f) => f.createdAt >= m.startsAt && f.createdAt < m.endsAt,
    );
    progress =
      m.kind === "weeklyImpact"
        ? Math.floor(
            eligible.reduce((s, f) => s + Math.max(0, f.currentTotal || 0), 0),
          )
        : eligible.filter((f) => f.currentTotal > 0).length;
  }
  return {
    id: String(m._id),
    kind: m.kind,
    title: m.title,
    detail: m.detail,
    progress: Math.min(progress, m.target),
    target: m.target,
    seedReward: m.seedReward,
    rewardPointBonus: m.rewardPointBonus,
    state:
      progress >= m.target
        ? "completed"
        : progress > 0
          ? "inProgress"
          : "available",
    actionTitle: "ابدأ المهمة",
  };
}
async function dashboard(amb) {
  const cfg = await settings();
  const { available, funds, raised } = await balance(amb);
  const player = await M.Player.findOne({ ambassador: amb._id }).lean();
  const best = player?.bestStars || {};
  const completed = Object.keys(best)
    .map(Number)
    .sort((a, b) => a - b);
  const stars = Object.values(best).reduce((s, n) => s + n, 0);
  const localBoxes = await M.Box.find({ ambassador: amb._id })
    .sort({ createdAt: -1 })
    .lean();
  const boxes = localBoxes.map((b) =>
    boxDTO(
      b,
      cfg,
      funds.find((f) => f.id === b.externalId),
    ),
  );
  for (const f of funds) {
    if (localBoxes.some((b) => b.externalId === f.id)) continue;
    boxes.push(
      boxDTO(
        {
          _id: `fund-${f.id}`,
          title: f.name,
          target: f.price_goal,
          state: "active",
          shareURL: `https://donate.utq.org.sa/goal_${f.id}`,
          createdAt: f.createdAt,
        },
        cfg,
        f,
      ),
    );
  }
  const prizes = cfg.storeEnabled
    ? await Prize.find({ active: true }).sort({ order: 1 }).lean()
    : [];
  const products = [];
  for (const p of prizes) {
    const taken = await PrizeRequest.countDocuments({
      prizeId: p.key,
      status: { $in: ACTIVE_ORDERS },
    });
    products.push({
      id: p.key,
      name: p.name,
      detail: p.description,
      pointCost: cost(p),
      stock: Math.max(0, p.stock - taken),
      symbolName: "gift.fill",
      tintHex: "2B7968",
      requiresShipping: p.requiresShipping,
    });
  }
  const missions = cfg.missionsEnabled
    ? await M.Mission.find({
        active: true,
        startsAt: { $lte: new Date() },
        endsAt: { $gt: new Date() },
      }).lean()
    : [];
  const totals = await AllFund.aggregate([
    { $group: { _id: null, total: { $sum: "$currentTotal" } } },
  ]);
  return {
    profile: {
      id: String(amb._id),
      name: amb.name,
      avatarInitials: amb.name.substring(0, 1),
      rewardPoints: available,
      gameSeeds: player?.seeds || 0,
      level: 1 + Math.floor(stars / 5),
      levelProgress: (stars % 5) / 5,
      playStyle: "calm",
      hapticsEnabled: true,
      soundEnabled: true,
    },
    impact: {
      totalRaised: raised,
      donors: funds.reduce((s, f) => s + (f.orderCount || 0), 0),
      successfulShares: player?.shares || 0,
      activeBoxes: boxes.filter((b) => b.state === "active").length,
      collectiveSeasonRaised: totals[0]?.total || 0,
      collectiveSeasonTarget: cfg.seasonTarget,
    },
    boxes,
    products,
    missions: await Promise.all(missions.map((m) => missionDTO(m, amb))),
    gameProgress: {
      unlockedLevel: Math.min(12, (completed.at(-1) || 0) + 1),
      completedLevels: completed,
      bestStarsByLevel: best,
      oasisStage: Math.min(5, 1 + Math.floor(completed.length / 3)),
      treesGrown: 1 + completed.length,
      totalPuzzlesSolved: completed.length,
    },
    generalShareURL: cfg.generalShareURL,
  };
}
module.exports = { dashboard, boxDTO, missionDTO, iso };

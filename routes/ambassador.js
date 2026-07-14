const express = require('express');
const Ambassador = require('../models/Ambassador');
const PrizeRequest = require('../models/PrizeRequest');
const Fund = require('../models/Fund');
const AllFund = require('../models/AllFund');
const BonusPoints = require('../models/BonusPoints');
const { requireAmbassador } = require('../middleware/auth');
const { logAmbassadorActivity } = require('../services/activityLog');
const { trySendWhatsapp } = require('../services/whatsapp');
const { ENTITIES, entityName, listEntities } = require('../services/entities');
const { NODE_BY_ID } = require('../services/passMap');

const NON_MEMBER_ENTITY = '550';





const router = express.Router();

const PRIZE_TIERS = [
  { id: 'bronze', name: 'الجائزة البرونزية', amount: 1000 },
  { id: 'silver', name: 'الجائزة الفضية', amount: 3000 },
  { id: 'gold', name: 'الجائزة الذهبية', amount: 5000 },
  { id: 'diamond', name: 'الجائزة الماسية', amount: 10000 },
];
const TIER_BY_ID = Object.fromEntries(PRIZE_TIERS.map((t) => [t.id, t]));

async function getStats(amb) {
  let totalDonations = 0;
  let orderCount = 0;
  let goals = [];
  try {
    const clientId = amb.platformProfileId ? Number(amb.platformProfileId) : null;
    if (clientId) {
      const funds = await AllFund.find({ client_id: clientId }).lean();
      totalDonations = funds.reduce((s, f) => s + (Number(f.currentTotal) || 0), 0);
      // console.log(`[getStats] totalDonations for ${amb.phone}:`, funds);
      orderCount = funds.reduce(
        (s, f) => s + ((Number(f.currentTotal) || 0) > 0 ? (Number(f.orderCount) || 0) : 0),
        0,
      );
      goals = funds.map((f) => ({
        pk: f.id,
        name: f.name || '',
        total: Number(f.currentTotal) || 0,
        goal: Number(f.price_goal) || 800,
      }));
    }
  } catch (e) {
    console.error(`[getStats] failed to read funds for ${amb.phone}:`, e.message);
  }

  let bonusPoints = 0;
  let bonusEntries = [];
  let passClaimedIds = [];
  try {
    const entries = await BonusPoints.find({ ambassador: amb._id }).sort({ createdAt: -1 }).lean();
    bonusPoints = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    bonusEntries = entries.map((e) => ({
      _id: String(e._id),
      amount: Number(e.amount) || 0,
      reason: e.reason || '',
      createdAt: e.createdAt,
      ...(e.passNodeId ? { passNodeId: e.passNodeId } : {}),
    }));
    passClaimedIds = entries.filter((e) => e.passNodeId).map((e) => e.passNodeId);
  } catch (e) {
    console.error(`[getStats] failed to read bonus points for ${amb.phone}:`, e.message);
  }

  const totalPoints = totalDonations + bonusPoints;

  const approved = await PrizeRequest.find({ ambassador: amb._id, status: { $in: ['approved', 'paid'] } });
  const paid = approved.reduce((s, r) => s + r.amount, 0);
  const pending = await PrizeRequest.find({ ambassador: amb._id, status: 'pending' });
  const pendingAmount = pending.reduce((s, r) => s + r.amount, 0);

  const claimedAmount = paid + pendingAmount;
  const availableBalance = Math.max(0, totalPoints - claimedAmount);

  const sortedTiers = [...PRIZE_TIERS].sort((a, b) => a.amount - b.amount);
  const tiers = sortedTiers.map((t) => ({
    id: t.id,
    name: t.name,
    amount: t.amount,
    canClaim: availableBalance >= t.amount,
  }));
  const nextTier = sortedTiers.find((t) => t.amount > availableBalance) || sortedTiers[sortedTiers.length - 1];

  return {
    totalDonations,
    bonusPoints,
    bonusEntries,
    passClaimedIds,
    totalPoints,
    orderCount,
    paid,
    pendingAmount,
    claimedAmount,
    availableBalance,
    tiers,
    nextTier,
    goals,
  };
}

function wantsHtmlNavigation(req) {
  const accept = String(req.get('accept') || '').toLowerCase();
  const secFetchDest = String(req.get('sec-fetch-dest') || '').toLowerCase();
  const secFetchMode = String(req.get('sec-fetch-mode') || '').toLowerCase();
  return secFetchDest === 'document' || secFetchMode === 'navigate' || accept.includes('text/html');
}

async function sendFundsData(req, res) {
  try {
    const amb = await Ambassador.findById(req.session.ambassadorId);
    if (!amb) return res.status(404).json({ error: 'غير موجود' });
    if (!amb.platformProfileId) {
      return res.json({ results: [], stats: { total: 0, completed: 0, incomplete: 0 } });
    }

    const clientId = Number(amb.platformProfileId);
    const funds = await AllFund.find({ client_id: clientId }).lean();

    const items = funds.map((g) => {
      const stats = g.stats || {};
      const priceGoal = Number(g.price_goal || 0);
      const currentTotal = Number(g.currentTotal || 0);
      const soldTotal = Number(stats.sold_total || 0);
      const progress = priceGoal > 0 ? Math.min(100, (soldTotal / priceGoal) * 100) : Number(stats.progress || 0);
      return {
        id: g.id,
        name: g.name || '',
        priceGoal,
        soldTotal,
        currentTotal,
        soldCount: Number(g.orderCount || stats.sold_count || 0),
        visits: Number(stats.visits || 0),
        progress,
        completed: progress >= 100,
        shareUrl: `https://donate.utq.org.sa/goal_${g.id}`,
      };
    }).sort((a, b) => b.soldTotal - a.soldTotal);

    const completed = items.filter((g) => g.completed).length;
    res.json({
      results: items,
      stats: {
        total: items.length,
        completed,
        incomplete: items.length - completed,
      },
    });
  } catch (e) {
    console.error('[ambassador/funds] failed:', e.message);
    res.json({ results: [], stats: { total: 0, completed: 0, incomplete: 0 }, error: 'fetch_failed' });
  }
}

router.get('/me', requireAmbassador, async (req, res) => {
  const amb = await Ambassador.findById(req.session.ambassadorId);
  if (!amb) return res.status(404).json({ error: 'غير موجود' });
  const stats = await getStats(amb);
  const link = `${req.protocol}://${req.get('host')}/r/${amb.referralCode}`;
  amb.totalDonations = stats.totalDonations;
  amb.orderCount = stats.orderCount;
  amb.donationsUpdatedAt = new Date();
  amb.save().catch((e) => console.error('[get /me] failed to update donations:', e.message));
  res.json({
    ambassador: {
      name: amb.name,
      phone: amb.phone,
      isMember: amb.isMember,
      entity: amb.entity,
      referralCode: amb.referralCode,
      referralLink: link,
    },
    stats,
  });
});

router.get('/profile', requireAmbassador, async (req, res) => {
  const amb = await Ambassador.findById(req.session.ambassadorId, 'name phone isMember entity');
  if (!amb) return res.status(404).json({ error: 'غير موجود' });
  res.json({
    ok: true,
    profile: {
      name: amb.name,
      phone: amb.phone,
      isMember: !!amb.isMember,
      entity: amb.entity,
      entityName: entityName(amb.entity),
    },
    entities: listEntities().filter((e) => e.id !== NON_MEMBER_ENTITY),
  });
});

router.post('/profile', requireAmbassador, async (req, res) => {
  const amb = await Ambassador.findById(req.session.ambassadorId);
  if (!amb) return res.status(404).json({ error: 'غير موجود' });

  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'الرجاء إدخال الاسم' });
  if (name.length > 100) return res.status(400).json({ error: 'الاسم طويل جداً' });

  const isMember = req.body?.isMember === true || req.body?.isMember === 'true';
  let entity;
  if (isMember) {
    entity = String(req.body?.entity ?? '').trim();
    if (!ENTITIES[entity] || entity === NON_MEMBER_ENTITY) {
      return res.status(400).json({ error: 'الرجاء اختيار جهة صحيحة' });
    }
  } else {
    entity = NON_MEMBER_ENTITY;
  }

  const before = { name: amb.name, isMember: !!amb.isMember, entity: amb.entity };
  amb.name = name;
  amb.isMember = isMember;
  amb.entity = entity;
  await amb.save();

  req.session.ambassadorName = amb.name;

  await logAmbassadorActivity({
    ambassadorId: amb._id,
    action: 'update_profile',
    details: { before, after: { name, isMember, entity } },
    source: 'server',
    path: '/ambassador/profile',
  });

  res.json({
    ok: true,
    profile: {
      name: amb.name,
      phone: amb.phone,
      isMember: amb.isMember,
      entity: amb.entity,
      entityName: entityName(amb.entity),
    },
  });
});

router.get('/entry-link', requireAmbassador, async (req, res) => {
  const amb = await Ambassador.findById(req.session.ambassadorId, 'referralCode');
  if (!amb || !amb.referralCode) {
    return res.status(404).json({ error: 'تعذر إنشاء الرابط السري' });
  }

  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = req.get('x-forwarded-host') || req.get('host');
  const entryLink = `${proto}://${host}/r/${amb.referralCode}`;

  res.json({
    ok: true,
    entryLink,
    note: 'الدخول السريع بدون رمز عبر هذا الرابط',
  });
});

router.post('/activity', requireAmbassador, async (req, res) => {
  const action = String(req.body?.action || '').trim();
  if (!action) return res.status(400).json({ error: 'action_required' });

  const detailsRaw = req.body?.details;
  const details = detailsRaw && typeof detailsRaw === 'object' ? detailsRaw : {};
  const path = String(req.body?.path || req.originalUrl || '').slice(0, 200);

  await logAmbassadorActivity({
    ambassadorId: req.session.ambassadorId,
    action: action.slice(0, 120),
    details,
    source: 'client',
    path,
  });

  res.json({ ok: true });
});

router.get('/funds', requireAmbassador, async (req, res) => {
  if (wantsHtmlNavigation(req)) return res.redirect('/ambassador/fund');
  return sendFundsData(req, res);
});

router.get('/funds-data', requireAmbassador, sendFundsData);

router.get('/prize-stock', requireAmbassador, async (req, res) => {
  try {
    const rows = await PrizeRequest.aggregate([
      { $match: { status: { $in: ['pending', 'approved', 'paid'] }, prizeId: { $nin: ['', null] } } },
      { $group: { _id: '$prizeId', count: { $sum: 1 } } },
    ]);
    const distributed = {};
    for (const r of rows) distributed[r._id] = r.count;
    res.json({ distributed });
  } catch (e) {
    console.error('[ambassador/prize-stock] failed:', e.message);
    res.json({ distributed: {} });
  }
});

router.get('/requests', requireAmbassador, async (req, res) => {
  const list = await PrizeRequest.find({ ambassador: req.session.ambassadorId })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ requests: list });
});

router.post('/requests', requireAmbassador, async (req, res) => {
  const amb = await Ambassador.findById(req.session.ambassadorId);
  if (!amb) return res.status(404).json({ error: 'غير موجود' });
  const tier = TIER_BY_ID[req.body && req.body.tier];
  if (!tier) return res.status(400).json({ error: 'تصنيف الجائزة غير صالح' });
  const stats = await getStats(amb);
  if (stats.availableBalance < tier.amount) {
    return res.status(400).json({ error: 'رصيدك غير كافٍ لطلب هذه الجائزة' });
  }
  const prizeId = String((req.body && req.body.prizeId) || '').slice(0, 60);
  const prizeName = String((req.body && req.body.prizeName) || '').slice(0, 200);

  const reqDoc = await PrizeRequest.create({
    ambassador: amb._id,
    amount: tier.amount,
    tier: tier.id,
    status: 'pending',
    prizeId,
    prizeName,
  });

  await logAmbassadorActivity({
    ambassadorId: amb._id,
    action: 'request_prize',
    details: { tier: tier.id, amount: tier.amount, prizeId, prizeName },
    source: 'server',
    path: '/ambassador/requests',
  });

  const prizeLine = prizeName ? `\nالجائزة المختارة: ${prizeName}` : '';
  await trySendWhatsapp(
    amb.phone,
    `مرحباً ${amb.name} 👋\nتم استلام طلبك لـ${tier.name} بقيمة ${tier.amount} ريال.${prizeLine}\nسيتم مراجعة الطلب قريباً، وعند تغيّر حالة الطلب سيتم التواصل معك بشكل مباشر.`,
    'prize-request'
  );

  res.json({ ok: true, request: reqDoc });
});

// ===== خريطة الرحلة — استلام مكافأة مرحلة (تُصرف كنقاط إضافية في قاعدة البيانات) =====
router.post('/pass/claim', requireAmbassador, async (req, res) => {
  const amb = await Ambassador.findById(req.session.ambassadorId);
  if (!amb) return res.status(404).json({ error: 'غير موجود' });

  const nodeId = String((req.body && req.body.nodeId) || '').trim();
  const node = NODE_BY_ID[nodeId];
  if (!node) return res.status(400).json({ error: 'مرحلة غير صالحة' });

  let stats = await getStats(amb);
  if (stats.passClaimedIds.includes(node.id)) {
    return res.status(400).json({ error: 'استلمت مكافأة هذه المرحلة من قبل', stats });
  }
  if (stats.totalPoints < node.threshold) {
    return res.status(400).json({ error: 'لم تصل نقاطك لهذه المرحلة بعد', stats });
  }

  try {
    await BonusPoints.create({
      ambassador: amb._id,
      amount: node.reward,
      reason: `مكافأة خريطة الرحلة — ${node.title}`,
      source: 'pass',
      passNodeId: node.id,
    });
  } catch (e) {
    // فهرس فريد (ambassador + passNodeId) — طلبان متزامنان لنفس المرحلة
    if (e && e.code === 11000) {
      return res.status(400).json({ error: 'استلمت مكافأة هذه المرحلة من قبل', stats });
    }
    console.error('[ambassador/pass/claim] failed:', e.message);
    return res.status(500).json({ error: 'تعذر استلام المكافأة' });
  }

  await logAmbassadorActivity({
    ambassadorId: amb._id,
    action: 'claim_pass_reward',
    details: { nodeId: node.id, title: node.title, reward: node.reward },
    source: 'server',
    path: '/ambassador/pass/claim',
  });

  stats = await getStats(amb);
  res.json({ ok: true, claimed: { nodeId: node.id, reward: node.reward, title: node.title }, stats });
});

module.exports = router;

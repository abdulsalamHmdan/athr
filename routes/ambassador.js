const express = require('express');
const Ambassador = require('../models/Ambassador');
const PrizeRequest = require('../models/PrizeRequest');
const Fund = require('../models/Fund');
const AllFund = require('../models/AllFund');
const { requireAmbassador } = require('../middleware/auth');
const { logAmbassadorActivity } = require('../services/activityLog');
const { trySendWhatsapp } = require('../services/whatsapp');





const router = express.Router();

const PRIZE_TIERS = [
  { id: 'bronze', name: 'الجائزة البرونزية', amount: 2000 },
  { id: 'silver', name: 'الجائزة الفضية', amount: 5000 },
  { id: 'gold', name: 'الجائزة الذهبية', amount: 10000 },
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

  const approved = await PrizeRequest.find({ ambassador: amb._id, status: { $in: ['approved', 'paid'] } });
  const paid = approved.reduce((s, r) => s + r.amount, 0);
  const pending = await PrizeRequest.find({ ambassador: amb._id, status: 'pending' });
  const pendingAmount = pending.reduce((s, r) => s + r.amount, 0);

  const claimedAmount = paid + pendingAmount;
  const availableBalance = Math.max(0, totalDonations - claimedAmount);

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

module.exports = router;

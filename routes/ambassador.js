const express = require('express');
const Ambassador = require('../models/Ambassador');
const PrizeRequest = require('../models/PrizeRequest');
const Fund = require('../models/Fund');
const { requireAmbassador } = require('../middleware/auth');

const router = express.Router();

const PRIZE_TIERS = [
  { id: 'bronze', name: 'الجائزة البرونزية', amount: 2000 },
  { id: 'silver', name: 'الجائزة الفضية', amount: 5000 },
  { id: 'gold', name: 'الجائزة الذهبية', amount: 10000 },
];
const TIER_BY_ID = Object.fromEntries(PRIZE_TIERS.map((t) => [t.id, t]));

async function getStats(amb) {
  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
  let totalDonations = 0;
  let orderCount = 0;
  let goals = [];
  try {
    const r = await fetch(`${baseUrl}/api/donations/${encodeURIComponent(amb.phone)}`);
    const data = await r.json();
    console.log(`[getStats] donations for ${amb.phone}:`, data); // --- IGNORE ---
    totalDonations = data.total || 0;
    orderCount = data.orderCount || 0;
    goals = Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    console.error(`[getStats] failed to fetch donations for ${amb.phone}:`, e.message);
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
  const reqDoc = await PrizeRequest.create({
    ambassador: amb._id,
    amount: tier.amount,
    status: 'pending',
  });
  res.json({ ok: true, request: reqDoc });
});

module.exports = router;

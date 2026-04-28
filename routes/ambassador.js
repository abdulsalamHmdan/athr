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
  let goals = [];
  try {
    const r = await fetch(`${baseUrl}/api/donations/${encodeURIComponent(amb.phone)}`);
    const data = await r.json();
    totalDonations = data.total || 0;
    goals = Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    totalDonations = 0;
  }

  try {
    const localFunds = await Fund.find({ ambassador: amb._id }).sort({ createdAt: -1 }).lean();
    const existingKeys = new Set(
      goals.map((g) => String(g.pk || g.name || '').trim()).filter(Boolean)
    );
    for (const f of localFunds) {
      const key = String(f.externalId || f.name || '').trim();
      if (existingKeys.has(key) || existingKeys.has(String(f.name).trim())) continue;
      goals.push({
        pk: f.externalId || String(f._id),
        name: f.name,
        total: 0,
        goal: f.targetAmount || 0,
        local: true,
        ownerPhone: f.ownerPhone || '',
      });
    }
  } catch (e) {}

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
  const amb = await Ambassador.findById(req.session.ambassadorId).lean();
  if (!amb) return res.status(404).json({ error: 'غير موجود' });
  const stats = await getStats(amb);
  const link = `${req.protocol}://${req.get('host')}/r/${amb.referralCode}`;
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

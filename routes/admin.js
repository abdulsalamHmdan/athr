const express = require('express');
const Ambassador = require('../models/Ambassador');
const PrizeRequest = require('../models/PrizeRequest');
const AmbassadorActivity = require('../models/AmbassadorActivity');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', requireAdmin, async (req, res) => {
  const ambassadors = await Ambassador.find({}).lean();
  const members = ambassadors.filter((a) => a.isMember).length;
  const nonMembers = ambassadors.length - members;

  const approved = await PrizeRequest.find({ status: { $in: ['approved', 'paid'] } });
  const totalPrizes = approved.reduce((s, r) => s + r.amount, 0);

  let totalDonations = 0;
  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
  try {
    const r = await fetch(`${baseUrl}/api/donations-all`);
    const d = await r.json();
    totalDonations = d.total || 0;
  } catch (e) {}

  res.json({
    totalDonations,
    totalPrizes,
    ambassadorsCount: ambassadors.length,
    members,
    nonMembers,
    ambassadors: ambassadors.map((a) => ({
      _id: a._id,
      name: a.name,
      phone: a.phone,
      isMember: a.isMember,
      entity: a.entity,
      referralCode: a.referralCode,
    })),
  });
});

router.get('/requests-api', requireAdmin, async (req, res) => {
  const status = req.query.status;
  const filter = status ? { status } : {};
  const list = await PrizeRequest.find(filter)
    .populate('ambassador', 'name phone entity isMember')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ requests: list });
});

router.get('/activities', requireAdmin, async (req, res) => {
  const qLimit = Number(req.query.limit || 10);
  const limit = Number.isFinite(qLimit) ? Math.min(50, Math.max(1, qLimit)) : 10;

  const list = await AmbassadorActivity.find({})
    .populate('ambassador', 'name phone')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({
    activities: list.map((a) => ({
      _id: a._id,
      action: a.action || '',
      details: a.details || {},
      source: a.source || 'client',
      path: a.path || '',
      createdAt: a.createdAt,
      ambassador: a.ambassador
        ? {
            _id: a.ambassador._id,
            name: a.ambassador.name || 'سفير',
            phone: a.ambassador.phone || '',
          }
        : null,
    })),
  });
});

router.post('/requests/:id/approve', requireAdmin, async (req, res) => {
  const r = await PrizeRequest.findByIdAndUpdate(
    req.params.id,
    { status: 'approved', note: req.body.note || '' },
    { new: true }
  );
  if (!r) return res.status(404).json({ error: 'غير موجود' });
  res.json({ ok: true, request: r });
});

router.post('/requests/:id/reject', requireAdmin, async (req, res) => {
  const r = await PrizeRequest.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected', note: req.body.note || '' },
    { new: true }
  );
  if (!r) return res.status(404).json({ error: 'غير موجود' });
  res.json({ ok: true, request: r });
});

router.post('/requests/:id/paid', requireAdmin, async (req, res) => {
  const r = await PrizeRequest.findByIdAndUpdate(
    req.params.id,
    { status: 'paid', note: req.body.note || '' },
    { new: true }
  );
  if (!r) return res.status(404).json({ error: 'غير موجود' });
  res.json({ ok: true, request: r });
});

module.exports = router;

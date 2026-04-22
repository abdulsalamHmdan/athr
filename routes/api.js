const express = require('express');
const Fund = require('../models/Fund');
const router = express.Router();

const GOALS_API = 'https://donate.utq.org.sa/api/v1/orders/report/goals:ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ';

router.get('/donations-all', async (req, res) => {
  try {
    const r = await fetch(`${GOALS_API}?ts=1772312400-1772744400`);
    const data = await r.json();
    res.json({
      total: data?.totals?.total || 0,
      currency: 'SAR',
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.json({ total: 0, currency: 'SAR', error: 'fetch_failed' });
  }
});

router.get('/donations/:phone', async (req, res) => {
  const phone = req.params.phone;
  try {
    const r = await fetch(`${GOALS_API}?goal_creator=${encodeURIComponent(phone)}`);
    const data = await r.json();
    // console.log('Fetched data for phone', phone, data);
    const total = data?.totals?.total || 0;
    const items = Array.isArray(data?.items)
      ? data.items.map((it) => ({
          pk: it.pk,
          name: it.name,  
          total: it.total || 0,
          goal: it.goal || 800,
        }))
      : [];
    res.json({
      phone,
      total,
      items,
      currency: 'SAR',
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.json({ phone, total: 0, items: [], currency: 'SAR', error: 'fetch_failed' });
  }
});

// ===== بيانات وهمية مؤقتة — استبدلها بالـ API الحقيقي لاحقاً =====
const PLATFORM_URL = 'https://donate.utq.org.sa/clients/otp_login';

// التحقق إن كان السفير عنده حساب على المنصة
router.get('/platform/check-account/:phone', async (req, res) => {
  const phone = req.params.phone;
  // بيانات وهمية: أي رقم ينتهي بـ 0 يُعتبر بدون حساب
  const hasAccount = !phone.endsWith('0');
  res.json({
    phone,
    hasAccount,
    platformUrl: PLATFORM_URL,
  });
});

// إنشاء صندوق جديد على المنصة
router.post('/platform/create-fund', async (req, res) => {
  const { name, targetAmount, waqfType, acceptAfterTarget, phone, ownerPhone } = req.body || {};
  if (!name || !targetAmount || !waqfType) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  const externalId = 'mock-' + Date.now();

  let saved = null;
  try {
    if (req.session && req.session.ambassadorId) {
      saved = await Fund.create({
        ambassador: req.session.ambassadorId,
        name,
        targetAmount: Number(targetAmount),
        waqfType: String(waqfType),
        acceptAfterTarget: !!acceptAfterTarget,
        phone: phone || '',
        ownerPhone: ownerPhone || '',
        externalId,
      });
    }
  } catch (e) {
    return res.status(500).json({ error: 'فشل حفظ الصندوق' });
  }

  res.json({
    ok: true,
    fund: {
      id: saved ? saved._id : externalId,
      name,
      targetAmount: Number(targetAmount),
      waqfType,
      acceptAfterTarget: !!acceptAfterTarget,
      phone,
      ownerPhone: ownerPhone || '',
      createdAt: saved ? saved.createdAt : new Date().toISOString(),
    },
  });
});

module.exports = router;

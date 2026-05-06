const express = require('express');
const Fund = require('../models/Fund');
const Ambassador = require('../models/Ambassador');
const { listEntities, entityName } = require('../services/entities');
const router = express.Router();

// ===== Public APIs (لا تتطلب تسجيل دخول) =====

// قائمة المجمعات مع إحصائيات مختصرة لكل مجمع
router.get('/public/centers', async (req, res) => {
  try {
    const entities = listEntities();
    const ambassadors = await Ambassador.find({}, 'entity totalDonations').lean();
    const fundsAgg = await Fund.aggregate([
      { $lookup: { from: 'ambassadors', localField: 'ambassador', foreignField: '_id', as: 'a' } },
      { $unwind: '$a' },
      { $group: { _id: '$a.entity', count: { $sum: 1 } } },
    ]);
    const fundsByEntity = Object.fromEntries(fundsAgg.map((x) => [String(x._id || ''), x.count]));

    const stats = entities.map((e) => {
      const ambs = ambassadors.filter((a) => String(a.entity || '') === String(e.id));
      const totalDonations = ambs.reduce((s, a) => s + (a.totalDonations || 0), 0);
      return {
        id: e.id,
        name: e.name,
        ambassadorsCount: ambs.length,
        totalDonations,
        fundsCount: fundsByEntity[e.id] || 0,
      };
    });

    res.json({ centers: stats });
  } catch (e) {
    res.status(500).json({ error: 'failed' });
  }
});

// تفاصيل مجمع محدد + قائمة السفراء مرتبة من الأعلى للأقل
router.get('/public/centers/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const ambassadors = await Ambassador
      .find({ entity: id }, 'name phone totalDonations donationsUpdatedAt')
      .lean();

    const ids = ambassadors.map((a) => a._id);
    const fundsAgg = await Fund.aggregate([
      { $match: { ambassador: { $in: ids } } },
      { $group: { _id: '$ambassador', count: { $sum: 1 } } },
    ]);
    const fundsByAmb = Object.fromEntries(fundsAgg.map((x) => [String(x._id), x.count]));

    const list = ambassadors.map((a) => ({
      id: String(a._id),
      name: a.name,
      phone: a.phone,
      totalDonations: a.totalDonations || 0,
      fundsCount: fundsByAmb[String(a._id)] || 0,
      donationsUpdatedAt: a.donationsUpdatedAt,
    }));
    list.sort((a, b) => b.totalDonations - a.totalDonations);

    const totalDonations = list.reduce((s, a) => s + a.totalDonations, 0);
    const fundsCount = list.reduce((s, a) => s + a.fundsCount, 0);

    res.json({
      center: {
        id,
        name: entityName(id),
        ambassadorsCount: list.length,
        fundsCount,
        totalDonations,
      },
      ambassadors: list,
    });
  } catch (e) {
    res.status(500).json({ error: 'failed' });
  }
});

const GOALS_API = 'https://donate.utq.org.sa/api/v1/orders/report/goals:ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ';

router.get('/donations-all', async (req, res) => {
  try {
    const r = await fetch(`${GOALS_API}`);
    // const r = await fetch(`${GOALS_API}?ts=1777755600-${Math.ceil(Date.now() / 1000)}`);
    
    const data = await r.json();
    console.log("Response:", data);
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
    // const r = await fetch(`${GOALS_API}?goal_creator=${encodeURIComponent(phone)}&ts=1777755600-${Math.ceil(Date.now() / 1000)}`);
    const r = await fetch(`${GOALS_API}?goal_creator=${encodeURIComponent(phone)}`);
    const data = await r.json();
    console.log(data);
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
  const { name, targetAmount, waqfType, acceptAfterTarget, ownerPhone } = req.body || {};
  if (!name || !targetAmount || !waqfType) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  
  
  let saved = null;
  try {
    if (req.session && req.session.ambassadorId) {
      const ambassador = await Ambassador.findById(req.session.ambassadorId);
      if (!ambassador) {
        return res.status(401).json({ error: 'Unauthorized' });
      }   
    const fetchResult = await fetch(`https://donate.utq.org.sa/api/v1/goal/new?type=51&name=${name}&prod_id=${waqfType}&client_id=${ambassador.platformProfileId}&price_goal=${targetAmount}&approved=1`,
    {method: 'get',headers:{'k':'ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ'}})
    const fetchData = await fetchResult.json();

    res.json({
    ok: true,
    fund: {
      id: fetchData.result.id,
      externalId: fetchData.result.id,
      name:fetchData.result.name,
      targetAmount: Number(fetchData.result.price_goal),
      waqfType,
      acceptAfterTarget: !!acceptAfterTarget,
      phone:ambassador.phone || '',
      ownerPhone: ownerPhone || '',
      shareUrl:`https://donate.utq.org.sa/goal_${fetchData.result.id}`,
      createdAt: new Date().toISOString(),
    },
  });
      // saved = await Fund.create({
      //   ambassador: req.session.ambassadorId,
      //   name,
      //   targetAmount: Number(targetAmount),
      //   waqfType: String(waqfType),
      //   acceptAfterTarget: !!acceptAfterTarget,
      //   phone: phone || '',
      //   ownerPhone: ownerPhone || '',
      //   externalId,
      // });
    }
  } catch (e) {
    console.error('Error creating fund:', e);
    return res.status(500).json({ error: 'فشل حفظ الصندوق' });
  }

  // const fundId = saved ? String(saved._id);
  // const shareUrl = `${PLATFORM_URL.replace(/\/+$/, '')}/funds/${encodeURIComponent(externalId)}`;


});

// ===== Mock platform APIs (استبدلها بالـ API الحقيقي عبر متغيرات .env) =====
// PLATFORM_VERIFY_URL  → POST  body: { phone, name }   → { profileId, hasAccount, created }
// PLATFORM_DONATIONS_URL → GET  ?phone=&profileId=     → { total }

router.post('/platform/verify-or-create', (req, res) => {
  const { phone, name } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone_required' });
  const hasAccount = !String(phone).endsWith('0');
  res.json({
    profileId: `mock-${phone}`,
    hasAccount,
    created: !hasAccount,
    name: name || '',
  });
});

router.get('/platform/donations-total', (req, res) => {
  const { phone } = req.query;
  const seed = String(phone || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  res.json({ total: (seed % 50) * 100, currency: 'SAR' });
});

module.exports = router;

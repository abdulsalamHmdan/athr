const express = require('express');
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const Notification = require('../models/Notification');
const Ambassador = require('../models/Ambassador');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

router.get('/api/push/public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

router.post('/api/push/subscribe', async (req, res) => {
  if (!req.session || !req.session.ambassadorId) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  const { subscription, userAgent } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'اشتراك غير صالح' });
  }
  try {
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        ambassador: req.session.ambassadorId,
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        userAgent: userAgent || '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('subscribe error:', e);
    res.status(500).json({ error: 'فشل تسجيل الاشتراك' });
  }
});

router.get('/admin/notifications-api', requireAdmin, async (req, res) => {
  const list = await Notification.find({})
    .populate('ambassador', 'name phone')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const subsCount = await PushSubscription.countDocuments();
  const subscribedAmbassadors = await PushSubscription.distinct('ambassador');
  res.json({
    notifications: list,
    subscriptionsCount: subsCount,
    subscribedAmbassadors: subscribedAmbassadors.length,
  });
});

router.post('/admin/notifications/send', requireAdmin, async (req, res) => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'إعدادات الإشعارات ناقصة على الخادم' });
  }
  const { title, body, url, target, ambassadorId } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'العنوان والنص مطلوبان' });

  const filter = {};
  let targetType = 'all';
  let ambDoc = null;
  if (target === 'ambassador' && ambassadorId) {
    targetType = 'ambassador';
    filter.ambassador = ambassadorId;
    ambDoc = await Ambassador.findById(ambassadorId).lean();
    if (!ambDoc) return res.status(400).json({ error: 'السفير غير موجود' });
  }

  const subs = await PushSubscription.find(filter);
  if (!subs.length) {
    const note = await Notification.create({
      title, body, url: url || '',
      target: targetType,
      ambassador: ambDoc ? ambDoc._id : null,
      sentCount: 0, failedCount: 0,
    });
    return res.json({ ok: true, sent: 0, failed: 0, total: 0, notification: note });
  }

  const payload = JSON.stringify({ title, body, url: url || '/' });
  let sent = 0, failed = 0;
  const stale = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
        payload
      );
      sent++;
    } catch (err) {
      failed++;
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        stale.push(s._id);
      }
    }
  }));

  if (stale.length) {
    await PushSubscription.deleteMany({ _id: { $in: stale } });
  }

  const note = await Notification.create({
    title, body, url: url || '',
    target: targetType,
    ambassador: ambDoc ? ambDoc._id : null,
    sentCount: sent, failedCount: failed,
  });

  res.json({ ok: true, sent, failed, total: subs.length, notification: note });
});

module.exports = router;

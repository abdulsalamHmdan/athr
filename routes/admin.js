const express = require('express');
const Ambassador = require('../models/Ambassador');
const PrizeRequest = require('../models/PrizeRequest');
const AmbassadorActivity = require('../models/AmbassadorActivity');
const Fund = require('../models/Fund');
const AllFund = require('../models/AllFund');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const BonusPoints = require('../models/BonusPoints');
const Prize = require('../models/Prize');
const { requireAdmin } = require('../middleware/auth');
const { trySendWhatsapp, sendWhatsapp } = require('../services/whatsapp');
const boardControl = require('../services/boardControl');

const router = express.Router();

function formatAmount(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function buildStatusMessage(status, reqDoc, note) {
  const name = reqDoc.ambassador && reqDoc.ambassador.name ? reqDoc.ambassador.name : 'السفير';
  const amount = formatAmount(reqDoc.amount);
  const tail = note ? `\n\nملاحظة: ${note}` : '';
  if (status === 'approved') {
    return `مرحباً ${name} ✅\nتم قبول طلب جائزتك بقيمة ${amount} ريال.\nسيتم التواصل معك قريباً لإتمام إجراءات الصرف.${tail}`;
  }
  if (status === 'rejected') {
    const reason = note ? `\nسبب الرفض: ${note}` : '';
    return `مرحباً ${name} ❌\nنأسف لإبلاغك بأنه تم رفض طلب جائزتك بقيمة ${amount} ريال.${reason}`;
  }
  if (status === 'paid') {
    return `مرحباً ${name} 💸\nتم صرف جائزتك بقيمة ${amount} ريال بنجاح.\nشكراً لجهودك في منصة "نقاط الأثر".${tail}`;
  }
  return '';
}

async function updateRequestStatus(req, res, status) {
  let r;
  const note = String(req.body?.note || '').slice(0,500);
  try {
    const { setOrderStatus } = require('../services/atharCore');
    r = await setOrderStatus(req.params.id, status, note, req.session.adminId);
    await r.populate('ambassador', 'name phone');
  } catch (e) { return res.status(e.status || 500).json({ error: e.status ? e.message : 'تعذّر تحديث الطلب' }); }

  if (r.ambassador && r.ambassador.phone) {
    const message = buildStatusMessage(status, r, note);
    if (message) {
      await trySendWhatsapp(r.ambassador.phone, message, `prize-${status}`);
    }
  }

  res.json({ ok: true, request: r });
}

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

router.post('/requests/:id/approve', requireAdmin, (req, res) => updateRequestStatus(req, res, 'approved'));
router.post('/requests/:id/reject', requireAdmin, (req, res) => updateRequestStatus(req, res, 'rejected'));
router.post('/requests/:id/paid', requireAdmin, (req, res) => updateRequestStatus(req, res, 'paid'));

router.post('/ambassadors/:id/send-link', requireAdmin, async (req, res) => {
  const amb = await Ambassador.findById(req.params.id);
  if (!amb) return res.status(404).json({ error: 'السفير غير موجود' });
  if (!amb.phone) return res.status(400).json({ error: 'لا يوجد رقم جوال لهذا السفير' });
  if (!amb.referralCode) return res.status(400).json({ error: 'لا يوجد رمز إحالة لهذا السفير' });

  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('x-forwarded-host') || req.get('host');
  const baseUrl = process.env.PUBLIC_URL || `${proto}://${host}`;
  const link = `sfeer.site/r/${amb.referralCode}`;
  const message = `مرحباً ${amb.name} 👋\nهذا رابط الدخول السريع الخاص بك:\n${link}\n\nلا تشاركه مع أحد.`;

  try {
    await sendWhatsapp(amb.phone, message);
    res.json({ ok: true, link });
  } catch (e) {
    console.error('[admin send-link] whatsapp send failed:', e.message);
    res.status(502).json({ error: e.userMessage || 'تعذّر إرسال الرابط عبر واتساب' });
  }
});

// التحكم بصفحة لوحة الشرف (إيقاف التحديث / إجبار الصفحات المفتوحة على التحديث)
router.get('/board-control', requireAdmin, (req, res) => {
  res.json(boardControl.getState());
});

router.post('/board-control/toggle', requireAdmin, (req, res) => {
  const next = boardControl.togglePaused();
  res.json(next);
});

router.post('/board-control/force-reload', requireAdmin, (req, res) => {
  const next = boardControl.bumpVersion();
  res.json(next);
});

router.delete('/ambassadors/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const amb = await Ambassador.findById(id);
  if (!amb) return res.status(404).json({ error: 'السفير غير موجود' });

  await Promise.all([
    Fund.deleteMany({ ambassador: id }),
    PrizeRequest.deleteMany({ ambassador: id }),
    AmbassadorActivity.deleteMany({ ambassador: id }),
    PushSubscription.deleteMany({ ambassador: id }),
    Notification.deleteMany({ ambassador: id }),
    BonusPoints.deleteMany({ ambassador: id }),
  ]);
  await Ambassador.deleteOne({ _id: id });

  res.json({ ok: true });
});

// ===== نقاط إضافية للسفراء =====

// قائمة السفراء مع نقاطهم الأساسية والإضافية والإجمالي
router.get('/bonus-points/ambassadors', requireAdmin, async (req, res) => {
  try {
    const ambassadors = await Ambassador.find(
      {},
      'name phone entity isMember platformProfileId'
    ).lean();

    const clientIds = ambassadors
      .map((a) => Number(a.platformProfileId))
      .filter((n) => Number.isFinite(n));
    const funds = await AllFund.find(
      { client_id: { $in: clientIds } },
      'client_id currentTotal'
    ).lean();

    const totalsByClient = new Map();
    for (const f of funds) {
      const cid = Number(f.client_id);
      const amount = Number(f.currentTotal) || 0;
      totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
    }

    const bonusAgg = await BonusPoints.aggregate([
      { $group: { _id: '$ambassador', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const bonusByAmb = new Map();
    for (const row of bonusAgg) {
      bonusByAmb.set(String(row._id), { total: row.total || 0, count: row.count || 0 });
    }

    const list = ambassadors.map((a) => {
      const cid = Number(a.platformProfileId);
      const basePoints = Number.isFinite(cid) ? totalsByClient.get(cid) || 0 : 0;
      const b = bonusByAmb.get(String(a._id)) || { total: 0, count: 0 };
      const bonusPoints = Number(b.total) || 0;
      return {
        _id: String(a._id),
        name: a.name || '',
        phone: a.phone || '',
        isMember: !!a.isMember,
        entity: a.entity || '',
        basePoints: Math.round(basePoints),
        bonusPoints: Math.round(bonusPoints),
        totalPoints: Math.round(basePoints + bonusPoints),
        bonusCount: b.count,
      };
    });

    res.json({ ambassadors: list });
  } catch (e) {
    console.error('[admin/bonus-points/ambassadors] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

// سجل النقاط الإضافية لسفير محدد
router.get('/bonus-points/:ambassadorId', requireAdmin, async (req, res) => {
  try {
    const amb = await Ambassador.findById(req.params.ambassadorId, 'name phone').lean();
    if (!amb) return res.status(404).json({ error: 'السفير غير موجود' });

    const entries = await BonusPoints.find({ ambassador: amb._id })
      .sort({ createdAt: -1 })
      .lean();

    const total = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    res.json({
      ambassador: { _id: String(amb._id), name: amb.name, phone: amb.phone },
      entries: entries.map((e) => ({
        _id: String(e._id),
        amount: Number(e.amount) || 0,
        reason: e.reason || '',
        createdAt: e.createdAt,
      })),
      total: Math.round(total),
    });
  } catch (e) {
    console.error('[admin/bonus-points/:ambassadorId] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

// إضافة نقاط إضافية لسفير
router.post('/bonus-points', requireAdmin, async (req, res) => {
  try {
    const ambassadorId = String((req.body && req.body.ambassadorId) || '').trim();
    const amount = Number(req.body && req.body.amount);
    const reason = String((req.body && req.body.reason) || '').trim().slice(0, 300);

    if (!ambassadorId) return res.status(400).json({ error: 'الرجاء اختيار السفير' });
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ error: 'الرجاء إدخال قيمة نقاط صحيحة' });
    }

    const amb = await Ambassador.findById(ambassadorId);
    if (!amb) return res.status(404).json({ error: 'السفير غير موجود' });

    const entry = await require('mongoose').connection.transaction(async session => {
      const { lockAmbassador, balance, fail } = require('../services/atharCore');
      await lockAmbassador(amb._id, session);
      if (amount < 0 && (await balance(amb, session)).available < -Math.round(amount)) fail(409, 'لا يمكن خصم نقاط محجوزة لطلبات');
      return (await BonusPoints.create([{ ambassador: amb._id, amount: Math.round(amount), reason, addedBy: req.session.adminId || null }], { session }))[0];
    });

    res.json({
      ok: true,
      entry: {
        _id: String(entry._id),
        amount: entry.amount,
        reason: entry.reason,
        createdAt: entry.createdAt,
      },
    });
  } catch (e) {
    console.error('[admin/bonus-points POST] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

// حذف سجل نقاط إضافية
router.delete('/bonus-points/entry/:id', requireAdmin, async (req, res) => {
  try {
    const r = await require('mongoose').connection.transaction(async session => {
      const { lockAmbassador, balance, fail } = require('../services/atharCore');
      const entry = await BonusPoints.findOne({ _id: req.params.id, source: 'admin' }).session(session);
      if (!entry) return null;
      const amb = await lockAmbassador(entry.ambassador, session);
      if (entry.amount > 0 && (await balance(amb, session)).available < entry.amount) fail(409, 'النقاط مرتبطة بطلبات قائمة ولا يمكن حذفها');
      await entry.deleteOne({ session });
      return entry;
    });
    if (!r) return res.status(404).json({ error: 'السجل غير موجود' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin/bonus-points DELETE] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

// ===== إدارة متجر الجوائز (الكتالوج في قاعدة البيانات) =====

const PRIZE_TIER_IDS = ['bronze', 'silver', 'gold', 'diamond'];

function sanitizePrizeInput(body) {
  const name = String(body?.name || '').trim().slice(0, 200);
  const description = String(body?.description || '').trim().slice(0, 1000);
  const image = String(body?.image || '').trim().slice(0, 500);
  const tier = String(body?.tier || '').trim();
  const stock = Math.max(0, Math.round(Number(body?.stock) || 0));
  const order = Math.round(Number(body?.order) || 0);
  const active = body?.active !== false && body?.active !== 'false';
  return { name, description, image, tier, stock, order, active };
}

// توليد معرف جديد بنمط المعرفات القديمة: b7, s8, d1...
async function nextPrizeKey(tier) {
  const prefix = tier === 'diamond' ? 'd' : tier[0];
  const rx = new RegExp(`^${prefix}(\\d+)$`);
  const existing = await Prize.find({ key: rx }, 'key').lean();
  let max = 0;
  for (const p of existing) {
    const m = String(p.key).match(rx);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

// قائمة الجوائز كاملة (تشمل المخفية) مع عدد الموزَّع من كل جائزة
router.get('/prizes/list', requireAdmin, async (req, res) => {
  try {
    const [prizes, distRows] = await Promise.all([
      Prize.find({}).sort({ tier: 1, order: 1, key: 1 }).lean(),
      PrizeRequest.aggregate([
        { $match: { status: { $in: ['pending', 'approved', 'paid'] }, prizeId: { $nin: ['', null] } } },
        { $group: { _id: '$prizeId', count: { $sum: 1 } } },
      ]),
    ]);
    const distributed = {};
    for (const r of distRows) distributed[r._id] = r.count;
    res.json({
      prizes: prizes.map((p) => ({
        _id: String(p._id),
        key: p.key,
        name: p.name,
        description: p.description || '',
        image: p.image || '',
        tier: p.tier,
        stock: Number(p.stock) || 0,
        active: p.active !== false,
        order: Number(p.order) || 0,
        distributed: distributed[p.key] || 0,
      })),
    });
  } catch (e) {
    console.error('[admin/prizes/list] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

// إضافة جائزة جديدة
router.post('/prizes', requireAdmin, async (req, res) => {
  try {
    const data = sanitizePrizeInput(req.body);
    if (!data.name) return res.status(400).json({ error: 'اسم الجائزة مطلوب' });
    if (!PRIZE_TIER_IDS.includes(data.tier)) {
      return res.status(400).json({ error: 'تصنيف الجائزة غير صالح' });
    }
    let key = String(req.body?.key || '').trim().slice(0, 60);
    if (!key) key = await nextPrizeKey(data.tier);
    const exists = await Prize.findOne({ key }).lean();
    if (exists) return res.status(400).json({ error: `المعرف ${key} مستخدم من قبل` });

    const prize = await Prize.create({ key, ...data });
    res.json({ ok: true, prize });
  } catch (e) {
    console.error('[admin/prizes POST] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

// تعديل جائزة
router.post('/prizes/:id', requireAdmin, async (req, res) => {
  try {
    const prize = await Prize.findById(req.params.id);
    if (!prize) return res.status(404).json({ error: 'الجائزة غير موجودة' });
    const data = sanitizePrizeInput(req.body);
    if (!data.name) return res.status(400).json({ error: 'اسم الجائزة مطلوب' });
    if (!PRIZE_TIER_IDS.includes(data.tier)) {
      return res.status(400).json({ error: 'تصنيف الجائزة غير صالح' });
    }
    Object.assign(prize, data);
    await prize.save();
    res.json({ ok: true, prize });
  } catch (e) {
    console.error('[admin/prizes UPDATE] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

// حذف جائزة نهائياً (سجل الطلبات السابقة يحتفظ باسم الجائزة نصاً فلا يتأثر)
router.delete('/prizes/:id', requireAdmin, async (req, res) => {
  try {
    const r = await Prize.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'الجائزة غير موجودة' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin/prizes DELETE] failed:', e.message);
    res.status(500).json({ error: 'failed' });
  }
});

module.exports = router;

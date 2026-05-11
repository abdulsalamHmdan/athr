const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Ambassador = require('../models/Ambassador');
const Admin = require('../models/Admin');
const { syncAmbassador } = require('../services/platformSync');

const router = express.Router();

const PHONE_RE = /^5[0-9]{8}$/;
const OTP_RE = /^[0-9]{6}$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3100';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || '';

function isValidPhone(phone) {
  return typeof phone === 'string' && PHONE_RE.test(phone);
}

function generateNumericCode(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function sendWhatsapp(phone, message) {
  const headers = { 'Content-Type': 'application/json' };
  if (WHATSAPP_API_KEY) headers['x-api-key'] = WHATSAPP_API_KEY;
  let r;
  try {
    r = await fetch(`${WHATSAPP_SERVICE_URL}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, message }),
    });
  } catch (e) {
    const err = new Error(`لا يمكن الاتصال بخدمة واتساب على ${WHATSAPP_SERVICE_URL} (${e.code || e.message})`);
    err.userMessage = 'خدمة واتساب غير متصلة. تأكد من تشغيل البوت.';
    throw err;
  }
  if (!r.ok) {
    let body = null;
    try { body = await r.json(); } catch (_) {}
    const serverMsg = body && body.error ? body.error : `HTTP ${r.status}`;
    const err = new Error(`whatsapp service ${r.status}: ${serverMsg}`);
    err.userMessage = serverMsg;
    err.status = r.status;
    throw err;
  }
}

router.post('/signup', async (req, res) => {
  try {
    const { name, phone, password, isMember, entity } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول' });
    if (!isValidPhone(phone))
      return res.status(400).json({ error: 'رقم الجوال يجب أن يكون 9 أرقام بدون صفر أو رمز الدولة' });

    const exists = await Ambassador.findOne({ phone });
    if (exists) return res.status(400).json({ error: 'رقم الجوال مسجل مسبقاً' });

    const hash = await bcrypt.hash(password, 10);
    const referralCode = crypto.randomBytes(4).toString('hex');

    let fetchData;
    try {
      const fetchResult = await fetch(`http://donate.utq.org.sa/api/v1/clients/new?phone=${"966"+phone}&name=${encodeURIComponent(name)}`,{method: 'get',headers:{'k':'ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ'}});
      fetchData = await fetchResult.json();
    } catch (e) {
      console.error('[signup] platform fetch failed:', e.message);
      return res.status(503).json({ error: 'تعذر الاتصال بمنصة التبرع، حاول لاحقاً' });
    }
    if (!fetchData || !fetchData.id) {
      return res.status(500).json({ error: fetchData?.msg || 'خطأ في الخادم' });
    }

    const amb = await Ambassador.create({
      name,
      phone,
      password: hash,
      isMember: !!isMember,
      platformProfileId: fetchData.id,
      entity: isMember ? entity || '' : '',
      referralCode,
    });

    req.session.ambassadorId = amb._id;
    req.session.ambassadorName = amb.name || 'السفير';

    // try {
    //   await syncAmbassador(amb);
    // } catch (e) {
    //   console.error('[signup] platform sync failed:', e.message);
    // }

    const link = `${req.protocol}://${req.get('host')}/r/${referralCode}`;
    res.json({ ok: true, referralLink: link, referralCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!isValidPhone(phone))
      return res.status(400).json({ error: 'رقم الجوال يجب أن يكون 9 أرقام بدون صفر أو رمز الدولة' });
    const amb = await Ambassador.findOne({ phone });
    if (!amb) return res.status(400).json({ error: 'بيانات غير صحيحة' });
    const ok = await bcrypt.compare(password, amb.password);
    if (!ok) return res.status(400).json({ error: 'بيانات غير صحيحة' });
    req.session.ambassadorId = amb._id;
    req.session.ambassadorName = amb.name || 'السفير';
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.post('/admin/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const admin = await Admin.findOne({ phone });
    if (!admin) return res.status(400).json({ error: 'بيانات غير صحيحة' });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(400).json({ error: 'بيانات غير صحيحة' });
    req.session.adminId = admin._id;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!isValidPhone(phone))
      return res.status(400).json({ error: 'رقم الجوال يجب أن يكون 9 أرقام بدون صفر أو رمز الدولة' });

    const amb = await Ambassador.findOne({ phone });
    if (!amb) return res.status(404).json({ error: 'الرقم غير مسجل كسفير' });

    const otp = generateNumericCode(6);
    const otpHash = await bcrypt.hash(otp, 10);
    await Ambassador.updateOne(
      { _id: amb._id },
      { $set: { resetOtp: otpHash, resetOtpExpires: new Date(Date.now() + OTP_TTL_MS) } }
    );

    try {
      await sendWhatsapp(
        phone,
        `مرحباً ${amb.name} 👋\nرمز التحقق لاستعادة الوصول إلى حسابك:\n*${otp}*\nصالح لمدة 10 دقائق.`
      );
    } catch (e) {
      console.error('[forgot-password] whatsapp send failed:', e.message);
      return res.status(502).json({ error: e.userMessage || 'تعذّر إرسال رمز التحقق عبر واتساب، حاول لاحقاً' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password] error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!isValidPhone(phone))
      return res.status(400).json({ error: 'رقم الجوال غير صحيح' });
    if (!otp || !OTP_RE.test(String(otp)))
      return res.status(400).json({ error: 'رمز التحقق يجب أن يكون 6 أرقام' });

    const amb = await Ambassador.findOne({ phone });
    if (!amb || !amb.resetOtp || !amb.resetOtpExpires) {
      return res.status(400).json({ error: 'لم يتم طلب إعادة تعيين كلمة المرور' });
    }
    if (amb.resetOtpExpires.getTime() < Date.now()) {
      await Ambassador.updateOne(
        { _id: amb._id },
        { $set: { resetOtp: null, resetOtpExpires: null } }
      );
      return res.status(400).json({ error: 'انتهت صلاحية رمز التحقق' });
    }

    const ok = await bcrypt.compare(String(otp), amb.resetOtp);
    if (!ok) return res.status(400).json({ error: 'رمز التحقق غير صحيح' });

    await Ambassador.updateOne(
      { _id: amb._id },
      { $set: { resetOtp: null, resetOtpExpires: null } }
    );

    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const loginLink = `${baseUrl}/r/${amb.referralCode}`;

    try {
      await sendWhatsapp(
        phone,
        `مرحباً ${amb.name} 👋\nهذا رابط الدخول السريع الخاص بك:\n${loginLink}\n\nلا تشاركه مع أحد.`
      );
    } catch (e) {
      console.error('[verify-otp] whatsapp send failed:', e.message);
      return res.status(502).json({ error: e.userMessage || 'تعذّر إرسال الرابط عبر واتساب، تواصل مع الإدارة' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[verify-otp] error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;

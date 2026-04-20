const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Ambassador = require('../models/Ambassador');
const Admin = require('../models/Admin');

const router = express.Router();

const PHONE_RE = /^[0-9]{9}$/;
function isValidPhone(phone) {
  return typeof phone === 'string' && PHONE_RE.test(phone);
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

    const amb = await Ambassador.create({
      name,
      phone,
      password: hash,
      isMember: !!isMember,
      entity: isMember ? entity || '' : '',
      referralCode,
    });

    req.session.ambassadorId = amb._id;
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

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;

const express = require('express');
const Ambassador = require('../models/Ambassador');
const router = express.Router();

router.get('/', (req, res) => res.render('index', { title: 'الرئيسية' }));
router.get('/signup', (req, res) => res.render('signup', { title: 'تسجيل سفير جديد' }));
router.get('/login', (req, res) => res.render('login', { title: 'تسجيل الدخول' }));
router.get('/dashboard', (req, res) => res.render('dashboard', { title: 'لوحة الإحصائيات' }));

router.get('/ambassador/home', (req, res) => {
  if (!req.session.ambassadorId) return res.redirect('/login');
  res.render('ambassador/home', { title: 'صفحتي', active: 'home' });
});
router.get('/ambassador/prizes', (req, res) => {
  if (!req.session.ambassadorId) return res.redirect('/login');
  res.render('ambassador/prizes', { title: 'صرف الجوائز', active: 'prizes' });
});

router.get('/ambassador/create-fund', (req, res) => {
  if (!req.session.ambassadorId) return res.redirect('/login');
  res.render('ambassador/create-fund', { title: 'إنشاء صندوق', active: 'create-fund' });
});

router.get('/admin/login', (req, res) => res.render('admin/login', { title: 'دخول الإدارة' }));
router.get('/admin/dashboard', (req, res) => {
  if (!req.session.adminId) return res.redirect('/admin/login');
  res.render('admin/dashboard', { title: 'لوحة الإدارة', active: 'dashboard' });
});
router.get('/admin/requests', (req, res) => {
  if (!req.session.adminId) return res.redirect('/admin/login');
  res.render('admin/requests', { title: 'متابعة الطلبات', active: 'requests' });
});

// رابط السفير — يسجّل الدخول تلقائياً ويحوّل لصفحته
router.get('/r/:code', async (req, res) => {
  const amb = await Ambassador.findOne({ referralCode: req.params.code });
  if (!amb) return res.status(404).render('notfound', { title: 'غير موجود' });
  req.session.ambassadorId = amb._id;
  res.redirect('/ambassador/home');
});

module.exports = router;

const express = require('express');
const Ambassador = require('../models/Ambassador');
const { listEntities, entityName } = require('../services/entities');
const router = express.Router();

function renderAmbassadorPage(req, res, view, locals) {
  if (!req.session.ambassadorId) return res.redirect('/login');
  const ambassadorName = req.session.ambassadorName || 'السفير';
  return res.render(view, { ...locals, ambassadorName });
}

// صفحات عامة بدون تسجيل دخول — قائمة المجمعات وتفاصيل كل مجمع
router.get('/centers',  (req, res) => {
  res.render('public/centers', {
    title: 'المجمعات',
    entities: listEntities(),
  });
});

router.get('/centers/:id', (req, res) => {
  const id = String(req.params.id);
  res.render('public/center-details', {
    title: entityName(id),
    entityId: id,
    entityNameAr: entityName(id),
  });
});

router.get('/', (req, res) => res.render('index', { title: 'الرئيسية' }));
router.get('/signup', (req, res) => res.render('signup', { title: 'تسجيل سفير جديد' }));
router.get('/login', (req, res) => res.render('login', { title: 'تسجيل الدخول' }));
router.get('/forgot-password', (req, res) => res.render('forgot-password', { title: 'إعادة تعيين كلمة المرور' }));
router.get('/dashboard', (req, res) => res.render('dashboard', { title: 'لوحة الإحصائيات' }));

router.get('/ambassador/home', (req, res) => {
  return renderAmbassadorPage(req, res, 'ambassador/home', { title: 'صفحتي', active: 'home' });
});
router.get('/ambassador/prizes', (req, res) => {
  if (!req.session.ambassadorId) return res.redirect('/login');
  return res.redirect('/ambassador/home?tab=prizes');
});

router.get('/ambassador/create-fund', (req, res) => {
  if (!req.session.ambassadorId) return res.redirect('/login');
  return res.redirect('/ambassador/home?tab=create');
});

router.get('/ambassador/fund', (req, res) => {
  if (!req.session.ambassadorId) return res.redirect('/login');
  return res.redirect('/ambassador/home?tab=funds');
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
router.get('/admin/notifications', (req, res) => {
  if (!req.session.adminId) return res.redirect('/admin/login');
  res.render('admin/notifications', { title: 'إرسال إشعارات', active: 'notifications' });
});

// رابط السفير — يسجّل الدخول تلقائياً ويحوّل لصفحته
router.get('/r/:code', async (req, res) => {
  const amb = await Ambassador.findOne({ referralCode: req.params.code });
  if (!amb) return res.status(404).render('notfound', { title: 'غير موجود' });
  req.session.ambassadorId = amb._id;
  req.session.ambassadorName = amb.name || 'السفير';
  res.redirect('/ambassador/home');
});

module.exports = router;

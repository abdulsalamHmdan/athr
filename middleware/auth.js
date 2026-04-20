exports.requireAmbassador = (req, res, next) => {
  if (req.session && req.session.ambassadorId) return next();
  if (req.accepts('html')) return res.redirect('/login.html');
  return res.status(401).json({ error: 'غير مصرح' });
};

exports.requireAdmin = (req, res, next) => {
  if (req.session && req.session.adminId) return next();
  if (req.accepts('html')) return res.redirect('/admin/login.html');
  return res.status(401).json({ error: 'غير مصرح' });
};

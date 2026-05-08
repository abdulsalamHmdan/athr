const AmbassadorActivity = require('../models/AmbassadorActivity');

async function logAmbassadorActivity({
  ambassadorId,
  action,
  details = {},
  source = 'client',
  path = '',
}) {
  if (!ambassadorId || !action) return null;
  try {
    return await AmbassadorActivity.create({
      ambassador: ambassadorId,
      action: String(action).trim(),
      details: details && typeof details === 'object' ? details : {},
      source: String(source || 'client').trim(),
      path: String(path || '').trim(),
    });
  } catch (err) {
    return null;
  }
}

module.exports = { logAmbassadorActivity };

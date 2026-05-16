// تحكّم وقت التشغيل بصفحة لوحة الشرف العامة (center-board)
// - paused: إن كان true تقوم الواجهة بإيقاف التحديث التلقائي
// - version: عند زيادتها تقوم الصفحات المفتوحة بإعادة التحميل تلقائيًا
// الحالة في الذاكرة فقط — تُستعاد إلى القيم الافتراضية عند إعادة تشغيل الخادم.

const state = {
  paused: false,
  version: 1,
  pausedAt: null,
  versionAt: new Date().toISOString(),
};

function getState() {
  return {
    paused: state.paused,
    version: state.version,
    pausedAt: state.pausedAt,
    versionAt: state.versionAt,
  };
}

function setPaused(paused) {
  state.paused = !!paused;
  state.pausedAt = state.paused ? new Date().toISOString() : null;
  return getState();
}

function togglePaused() {
  return setPaused(!state.paused);
}

function bumpVersion() {
  state.version += 1;
  state.versionAt = new Date().toISOString();
  return getState();
}

module.exports = {
  getState,
  setPaused,
  togglePaused,
  bumpVersion,
};

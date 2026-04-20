(function () {
  function showLoader() {
    document.querySelectorAll('[data-loader]').forEach((el) => (el.style.display = 'flex'));
    document.querySelectorAll('[data-content]').forEach((el) => (el.style.display = 'none'));
  }
  function showContent() {
    document.querySelectorAll('[data-loader]').forEach((el) => (el.style.display = 'none'));
    document.querySelectorAll('[data-content]').forEach((el) => (el.style.display = ''));
  }
  window.App = { showLoader, showContent };

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-logout]');
    if (!t) return;
    e.preventDefault();
    await fetch('/auth/logout', { method: 'POST' });
    location.href = '/';
  });
})();

(function () {
  const numberFormatter = new Intl.NumberFormat('en-US');
  const dateFormatter = new Intl.DateTimeFormat('ar-SA-u-nu-latn');
  const dateTimeFormatter = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  function formatNumber(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0';
    return numberFormatter.format(num);
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return dateFormatter.format(d);
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return dateTimeFormatter.format(d);
  }

  function animateNumber(el) {
    if (!el || el.dataset.countAnimated === '1') return;
    const raw = (el.textContent || '').trim();
    if (!raw) return;

    const match = raw.match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!match) return;

    const from = Number((match[0] || '0').replace(/,/g, ''));
    if (!Number.isFinite(from)) return;

    const prefix = raw.slice(0, match.index);
    const suffix = raw.slice((match.index || 0) + match[0].length);
    const to = from;
    const duration = 550;
    const start = performance.now();
    el.dataset.countAnimated = '1';

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(to * eased);
      el.textContent = prefix + formatNumber(current) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + formatNumber(to) + suffix;
    };
    requestAnimationFrame(step);
  }

  function animateNumbers(root) {
    root.querySelectorAll(
      '.stat .v, .tier-amount, .goal-nums b, .cc-total-v, .dash-total-value, .dash-tile-value, .dash-rank-val'
    ).forEach(animateNumber);
  }

  function revealCollections(root) {
    const targets = root.querySelectorAll(
      '.stat, .tier, .goal-item, .center-card, .hist-row, .table-cards tbody tr, .dash-rank-item, .dash-tile'
    );
    targets.forEach((el, i) => {
      if (el.dataset.revealed === '1') return;
      el.dataset.revealed = '1';
      el.style.setProperty('--reveal-delay', `${Math.min(i * 28, 360)}ms`);
      el.classList.add('reveal-item');
    });
  }

  function showLoader() {
    document.querySelectorAll('[data-loader]').forEach((el) => (el.style.display = 'flex'));
    document.querySelectorAll('[data-content]').forEach((el) => (el.style.display = 'none'));
  }

  function showContent() {
    document.querySelectorAll('[data-loader]').forEach((el) => (el.style.display = 'none'));
    document.querySelectorAll('[data-content]').forEach((el) => {
      el.style.display = '';
      revealCollections(el);
      animateNumbers(el);
    });
  }

  window.App = { showLoader, showContent, formatNumber, formatDate, formatDateTime };

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-logout]');
    if (!t) return;
    e.preventDefault();
    await fetch('/auth/logout', { method: 'POST' });
    location.href = '/';
  });
})();

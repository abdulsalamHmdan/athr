(function () {
  const motionApi =
    typeof window !== 'undefined' &&
    window.Motion &&
    typeof window.Motion.animate === 'function'
      ? window.Motion
      : null;
  const numberFormatter = new Intl.NumberFormat('en-US');
  const dateFormatter = new Intl.DateTimeFormat('ar-SA-u-nu-latn');
  const dateTimeFormatter = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  let popupMounted = false;
  let popupQueue = Promise.resolve();
  let popupState = {
    root: null,
    title: null,
    body: null,
    input: null,
    altBtn: null,
    confirmBtn: null,
    cancelBtn: null,
    closeBtn: null,
    iconWrap: null,
  };

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
      '.stat .v, .tier-amount, .goal-nums b, .cc-total-v, .dash-total-value, .dash-tile-value, .dash-rank-val, .portfolio-value strong, .portfolio-meta-item b, .overview-stat b'
    ).forEach(animateNumber);
  }

  function revealCollections(root) {
    const targets = root.querySelectorAll(
      '.stat, .tier, .goal-item, .center-card, .hist-row, .table-cards tbody tr, .dash-rank-item, .dash-tile, .chart-card'
    );
    targets.forEach((el, i) => {
      if (el.dataset.revealed === '1') return;
      el.dataset.revealed = '1';
      const delay = Math.min(i * 0.028, 0.36);
      if (motionApi) {
        motionApi.animate(
          el,
          { opacity: [0, 1], transform: ['translateY(8px) scale(0.99)', 'translateY(0px) scale(1)'] },
          { duration: 0.42, delay, easing: [0.22, 1, 0.36, 1], fill: 'both' }
        );
      } else {
        el.style.setProperty('--reveal-delay', `${Math.min(i * 28, 360)}ms`);
        el.classList.add('reveal-item');
      }
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

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ensurePopup() {
    if (popupMounted) return popupState;
    const host = document.createElement('div');
    host.className = 'sys-popup';
    host.id = 'sysPopup';
    host.setAttribute('hidden', '');
    host.innerHTML = `
      <div class="sys-popup-backdrop" data-popup-close></div>
      <div class="sys-popup-card" role="dialog" aria-modal="true" aria-live="polite">
        <button type="button" class="sys-popup-close" data-popup-close aria-label="إغلاق">×</button>
        <div class="sys-popup-icon" data-popup-icon aria-hidden="true"></div>
        <h3 class="sys-popup-title" id="sysPopupTitle"></h3>
        <p class="sys-popup-body" id="sysPopupBody"></p>
        <input class="sys-popup-input" id="sysPopupInput" type="text" hidden>
        <div class="sys-popup-actions">
          <button type="button" class="btn flat" id="sysPopupAlt" hidden></button>
          <button type="button" class="btn secondary" id="sysPopupCancel" hidden>إلغاء</button>
          <button type="button" class="btn" id="sysPopupConfirm">حسناً</button>
        </div>
      </div>
    `;
    document.body.appendChild(host);
    popupMounted = true;
    popupState = {
      root: host,
      title: host.querySelector('#sysPopupTitle'),
      body: host.querySelector('#sysPopupBody'),
      input: host.querySelector('#sysPopupInput'),
      altBtn: host.querySelector('#sysPopupAlt'),
      confirmBtn: host.querySelector('#sysPopupConfirm'),
      cancelBtn: host.querySelector('#sysPopupCancel'),
      closeBtn: host.querySelector('.sys-popup-close'),
      iconWrap: host.querySelector('[data-popup-icon]'),
    };
    return popupState;
  }

  function popupIcon(type) {
    if (type === 'success') return '✓';
    if (type === 'error') return '!';
    if (type === 'warning') return '⚠';
    if (type === 'info') return 'i';
    return '•';
  }

  function popupOpen(config = {}) {
    const ui = ensurePopup();
    const {
      title = 'تنبيه',
      message = '',
      confirmText = 'حسناً',
      cancelText = 'إلغاء',
      altText = '',
      showCancel = false,
      showAlt = false,
      type = 'info',
      input = false,
      inputValue = '',
      inputPlaceholder = '',
      canClose = true,
    } = config;

    ui.root.dataset.type = type;
    ui.title.textContent = title;
    ui.body.innerHTML = escHtml(message).replace(/\n/g, '<br>');
    ui.confirmBtn.textContent = confirmText;
    ui.cancelBtn.textContent = cancelText;
    ui.altBtn.textContent = altText;
    ui.cancelBtn.hidden = !showCancel;
    ui.altBtn.hidden = !showAlt;
    ui.closeBtn.hidden = !canClose;
    ui.iconWrap.textContent = popupIcon(type);
    ui.confirmBtn.className = 'btn';
    ui.cancelBtn.className = 'btn secondary';
    ui.altBtn.className = 'btn flat';

    if (input) {
      ui.input.hidden = false;
      ui.input.value = inputValue || '';
      ui.input.placeholder = inputPlaceholder || '';
    } else {
      ui.input.hidden = true;
      ui.input.value = '';
      ui.input.placeholder = '';
    }

    ui.root.hidden = false;
    document.body.classList.add('modal-open');

    const focusTarget = input
      ? ui.input
      : (!ui.confirmBtn.hidden ? ui.confirmBtn : (!ui.cancelBtn.hidden ? ui.cancelBtn : ui.altBtn));
    setTimeout(() => { if (focusTarget) focusTarget.focus(); }, 0);
    return ui;
  }

  function popupClose() {
    if (!popupMounted) return;
    popupState.root.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function queuePopup(factory) {
    const task = popupQueue.then(factory);
    popupQueue = task.catch(() => {});
    return task;
  }

  function notify(options = {}) {
    return queuePopup(() => new Promise((resolve) => {
      const cfg = typeof options === 'string' ? { message: options } : options;
      const ui = popupOpen({
        title: cfg.title || 'تنبيه',
        message: cfg.message || '',
        confirmText: cfg.confirmText || 'حسناً',
        type: cfg.type || 'info',
        showCancel: false,
        canClose: true,
      });

      const onDone = () => {
        ui.confirmBtn.removeEventListener('click', onDone);
        ui.root.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onEsc);
        popupClose();
        resolve(true);
      };
      const onBackdrop = (e) => {
        if (!e.target.closest('[data-popup-close]')) return;
        onDone();
      };
      const onEsc = (e) => {
        if (e.key === 'Escape') onDone();
      };

      ui.confirmBtn.addEventListener('click', onDone);
      ui.root.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onEsc);
    }));
  }

  function confirmDialog(options = {}) {
    return queuePopup(() => new Promise((resolve) => {
      const cfg = typeof options === 'string' ? { message: options } : options;
      const ui = popupOpen({
        title: cfg.title || 'تأكيد',
        message: cfg.message || '',
        confirmText: cfg.confirmText || 'تأكيد',
        cancelText: cfg.cancelText || 'إلغاء',
        type: cfg.type || 'warning',
        showCancel: true,
        canClose: true,
      });

      const done = (ok) => {
        ui.confirmBtn.removeEventListener('click', onOk);
        ui.cancelBtn.removeEventListener('click', onCancel);
        ui.root.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onEsc);
        popupClose();
        resolve(ok);
      };
      const onOk = () => done(true);
      const onCancel = () => done(false);
      const onBackdrop = (e) => {
        if (!e.target.closest('[data-popup-close]')) return;
        onCancel();
      };
      const onEsc = (e) => {
        if (e.key === 'Escape') onCancel();
      };

      ui.confirmBtn.addEventListener('click', onOk);
      ui.cancelBtn.addEventListener('click', onCancel);
      ui.root.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onEsc);
    }));
  }

  function promptDialog(options = {}) {
    return queuePopup(() => new Promise((resolve) => {
      const cfg = typeof options === 'string' ? { message: options } : options;
      const ui = popupOpen({
        title: cfg.title || 'إدخال',
        message: cfg.message || '',
        confirmText: cfg.confirmText || 'حفظ',
        cancelText: cfg.cancelText || 'إلغاء',
        type: cfg.type || 'info',
        showCancel: true,
        input: true,
        inputValue: cfg.defaultValue || '',
        inputPlaceholder: cfg.placeholder || '',
      });

      const done = (ok) => {
        const value = ok ? String(ui.input.value || '').trim() : null;
        ui.confirmBtn.removeEventListener('click', onOk);
        ui.cancelBtn.removeEventListener('click', onCancel);
        ui.root.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onEsc);
        ui.input.removeEventListener('keydown', onInputEnter);
        popupClose();
        resolve(value);
      };
      const onOk = () => done(true);
      const onCancel = () => done(false);
      const onBackdrop = (e) => {
        if (!e.target.closest('[data-popup-close]')) return;
        onCancel();
      };
      const onEsc = (e) => {
        if (e.key === 'Escape') onCancel();
      };
      const onInputEnter = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOk();
        }
      };

      ui.confirmBtn.addEventListener('click', onOk);
      ui.cancelBtn.addEventListener('click', onCancel);
      ui.root.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onEsc);
      ui.input.addEventListener('keydown', onInputEnter);
    }));
  }

  function actionsDialog(options = {}) {
    return queuePopup(() => new Promise((resolve) => {
      const cfg = typeof options === 'string' ? { message: options } : options;
      const acts = Array.isArray(cfg.actions) ? cfg.actions.slice(0, 3) : [];
      const ui = popupOpen({
        title: cfg.title || 'اختر الإجراء',
        message: cfg.message || '',
        type: cfg.type || 'success',
        showCancel: true,
        showAlt: true,
        confirmText: '',
        cancelText: '',
        altText: '',
      });

      const slots = [ui.confirmBtn, ui.cancelBtn, ui.altBtn];
      slots.forEach((btn, idx) => {
        const a = acts[idx];
        if (!a) {
          btn.hidden = true;
          return;
        }
        btn.hidden = false;
        btn.textContent = a.label || 'إجراء';
        btn.className = a.className || (idx === 0 ? 'btn' : idx === 1 ? 'btn secondary' : 'btn flat');
      });

      const onAction = (id) => {
        cleanup();
        popupClose();
        resolve(id || null);
      };

      const onFirst = () => onAction(acts[0] ? acts[0].id : null);
      const onSecond = () => onAction(acts[1] ? acts[1].id : null);
      const onThird = () => onAction(acts[2] ? acts[2].id : null);
      const onBackdrop = (e) => {
        if (!e.target.closest('[data-popup-close]')) return;
        onAction(null);
      };
      const onEsc = (e) => {
        if (e.key === 'Escape') onAction(null);
      };
      const cleanup = () => {
        ui.confirmBtn.removeEventListener('click', onFirst);
        ui.cancelBtn.removeEventListener('click', onSecond);
        ui.altBtn.removeEventListener('click', onThird);
        ui.root.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onEsc);
      };

      ui.confirmBtn.addEventListener('click', onFirst);
      ui.cancelBtn.addEventListener('click', onSecond);
      ui.altBtn.addEventListener('click', onThird);
      ui.root.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onEsc);
    }));
  }

  window.App = {
    showLoader,
    showContent,
    formatNumber,
    formatDate,
    formatDateTime,
    notify,
    confirm: confirmDialog,
    prompt: promptDialog,
    actions: actionsDialog,
  };

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-logout]');
    if (!t) return;
    e.preventDefault();
    await fetch('/auth/logout', { method: 'POST' });
    location.href = '/';
  });

  if (typeof window !== 'undefined') {
    window.alert = function (message) {
      notify({ title: 'تنبيه', message: String(message || ''), type: 'info' });
    };
  }
})();

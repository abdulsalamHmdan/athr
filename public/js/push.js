(function () {
  const STATE = {
    UNSUPPORTED: 'unsupported',
    IOS_NEED_INSTALL: 'ios-need-install',
    DENIED: 'denied',
    UNSUBSCRIBED: 'unsubscribed',
    SUBSCRIBED: 'subscribed',
    BUSY: 'busy',
  };

  const LABELS = {
    [STATE.UNSUPPORTED]: 'الإشعارات غير مدعومة في هذا المتصفح',
    [STATE.IOS_NEED_INSTALL]: 'لتفعيل الإشعارات على iPhone: أضف الموقع للشاشة الرئيسية أولاً',
    [STATE.DENIED]: 'الإشعارات محظورة — فعّلها من إعدادات المتصفح',
    [STATE.UNSUBSCRIBED]: 'تفعيل الإشعارات',
    [STATE.SUBSCRIBED]: 'الإشعارات مفعّلة ✓ (اضغط لإيقافها)',
    [STATE.BUSY]: 'جارٍ المعالجة…',
  };

  function isIconButton(btn) {
    return !!(btn && btn.hasAttribute('data-push-icon'));
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function getRegistration() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    try {
      return await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      return null;
    }
  }

  async function currentState() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return STATE.UNSUPPORTED;
    }
    if (isIOS() && !isStandalone()) return STATE.IOS_NEED_INSTALL;
    if (Notification.permission === 'denied') return STATE.DENIED;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return STATE.UNSUBSCRIBED;
    const sub = await reg.pushManager.getSubscription();
    return sub ? STATE.SUBSCRIBED : STATE.UNSUBSCRIBED;
  }

  function applyState(btn, state) {
    btn.dataset.pushState = state;
    const label = LABELS[state] || '';
    if (isIconButton(btn)) {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.classList.toggle('is-active', state === STATE.SUBSCRIBED);
      btn.classList.toggle('is-busy', state === STATE.BUSY);
    } else {
      btn.textContent = label;
    }
    const disabled = (state === STATE.UNSUPPORTED || state === STATE.IOS_NEED_INSTALL || state === STATE.DENIED || state === STATE.BUSY);
    btn.disabled = disabled;
    if (!isIconButton(btn)) {
      btn.classList.toggle('secondary', state !== STATE.UNSUBSCRIBED);
    }
  }

  async function subscribe(btn) {
    applyState(btn, STATE.BUSY);

    const reg = await getRegistration();
    if (!reg) { applyState(btn, STATE.UNSUPPORTED); return; }

    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        applyState(btn, perm === 'denied' ? STATE.DENIED : STATE.UNSUBSCRIBED);
        return;
      }
    } else if (Notification.permission === 'denied') {
      applyState(btn, STATE.DENIED);
      return;
    }

    let keyRes;
    try {
      keyRes = await fetch('/api/push/public-key').then((r) => r.json());
    } catch (e) {
      applyState(btn, STATE.UNSUBSCRIBED); return;
    }
    if (!keyRes || !keyRes.key) { applyState(btn, STATE.UNSUBSCRIBED); return; }

    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.key),
      });
    } catch (e) {
      applyState(btn, Notification.permission === 'denied' ? STATE.DENIED : STATE.UNSUBSCRIBED);
      return;
    }

    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, userAgent: navigator.userAgent }),
      });
    } catch (e) {}

    applyState(btn, STATE.SUBSCRIBED);
  }

  async function unsubscribe(btn) {
    applyState(btn, STATE.BUSY);
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        } catch (e) {}
        try { await sub.unsubscribe(); } catch (e) {}
      }
    }
    applyState(btn, STATE.UNSUBSCRIBED);
  }

  async function bindButton(btn) {
    if (!btn || btn.dataset.pushBound) return;
    btn.dataset.pushBound = '1';
    applyState(btn, await currentState());
    btn.addEventListener('click', async () => {
      const state = btn.dataset.pushState;
      if (state === STATE.SUBSCRIBED) return unsubscribe(btn);
      if (state === STATE.UNSUBSCRIBED) return subscribe(btn);
    });
  }

  async function bindAllButtons() {
    document.querySelectorAll('[data-push-subscribe]').forEach(bindButton);
  }

  async function askFromEntry(options = {}) {
    const {
      confirmText = 'هل تريد تفعيل الإشعارات الآن؟',
      iosText = 'لتفعيل الإشعارات على iPhone: أضف المنصة للشاشة الرئيسية أولاً ثم افتحها من الأيقونة.',
      sessionKey = 'athr_push_prompt_once',
    } = options;

    const btn = document.querySelector('[data-push-subscribe]');
    if (!btn) return;
    await bindButton(btn);
    const state = btn.dataset.pushState;

    if (sessionStorage.getItem(sessionKey) === '1') return;
    if (state === STATE.SUBSCRIBED || state === STATE.DENIED || state === STATE.UNSUPPORTED) return;

    if (state === STATE.IOS_NEED_INSTALL) {
      sessionStorage.setItem(sessionKey, '1');
      if (window.App && typeof window.App.notify === 'function') {
        await window.App.notify({
          title: 'تنبيه الإشعارات',
          message: iosText,
          type: 'info',
          confirmText: 'فهمت',
        });
      } else {
        window.alert(iosText);
      }
      return;
    }

    if (state !== STATE.UNSUBSCRIBED || Notification.permission !== 'default') return;

    sessionStorage.setItem(sessionKey, '1');
    const ok = window.App && typeof window.App.confirm === 'function'
      ? await window.App.confirm({
          title: 'تفعيل الإشعارات',
          message: confirmText,
          type: 'info',
          confirmText: 'تفعيل',
          cancelText: 'لاحقاً',
        })
      : window.confirm(confirmText);
    if (!ok) return;
    await subscribe(btn);
  }

  window.PushNotify = {
    bindAllButtons,
    askFromEntry,
    getState: currentState,
  };

  window.addEventListener('DOMContentLoaded', () => {
    bindAllButtons();
  });

  window.addEventListener('load', () => {
    bindAllButtons();
  });
})();

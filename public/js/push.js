(function () {
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function setupPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let reg;
    try {
      reg = await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      return;
    }

    if (Notification.permission === 'denied') return;

    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }

    let keyRes;
    try {
      keyRes = await fetch('/api/push/public-key').then((r) => r.json());
    } catch (e) {
      return;
    }
    if (!keyRes || !keyRes.key) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyRes.key),
        });
      } catch (e) {
        return;
      }
    }

    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, userAgent: navigator.userAgent }),
      });
    } catch (e) {}
  }

  window.addEventListener('load', () => {
    setupPush();
  });
})();

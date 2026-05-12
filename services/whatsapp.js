const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3100';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || '';

async function sendWhatsapp(phone, message) {
  const headers = { 'Content-Type': 'application/json' };
  if (WHATSAPP_API_KEY) headers['x-api-key'] = WHATSAPP_API_KEY;
  let r;
  try {
    r = await fetch(`${WHATSAPP_SERVICE_URL}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, message }),
    });
  } catch (e) {
    const err = new Error(`لا يمكن الاتصال بخدمة واتساب على ${WHATSAPP_SERVICE_URL} (${e.code || e.message})`);
    err.userMessage = 'خدمة واتساب غير متصلة. تأكد من تشغيل البوت.';
    throw err;
  }
  if (!r.ok) {
    let body = null;
    try { body = await r.json(); } catch (_) {}
    const serverMsg = body && body.error ? body.error : `HTTP ${r.status}`;
    const err = new Error(`whatsapp service ${r.status}: ${serverMsg}`);
    err.userMessage = serverMsg;
    err.status = r.status;
    throw err;
  }
}

async function trySendWhatsapp(phone, message, tag = 'whatsapp') {
  try {
    await sendWhatsapp(phone, message);
    return true;
  } catch (e) {
    console.error(`[${tag}] whatsapp send failed:`, e.message);
    return false;
  }
}

module.exports = { sendWhatsapp, trySendWhatsapp };

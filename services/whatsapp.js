const WA_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const WA_OTP_TEMPLATE = process.env.WHATSAPP_OTP_TEMPLATE || 'otp_athr';
const WA_OTP_LANG = process.env.WHATSAPP_OTP_LANG || 'ar';
const WA_DEFAULT_CC = process.env.WHATSAPP_DEFAULT_CC || '966';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) throw new Error('رقم الجوال مفقود');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return WA_DEFAULT_CC + digits.slice(1);
  if (digits.startsWith(WA_DEFAULT_CC)) return digits;
  if (digits.length === 9 && digits.startsWith('5')) return WA_DEFAULT_CC + digits;
  return digits;
}

async function metaCall(payload) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    const err = new Error('إعدادات واتساب Meta غير مكتملة (WHATSAPP_TOKEN/WHATSAPP_PHONE_ID)');
    err.userMessage = 'خدمة واتساب غير مهيأة';
    throw err;
  }

  const url = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`;
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WA_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const err = new Error(`تعذر الاتصال بـ Meta WhatsApp API (${e.code || e.message})`);
    err.userMessage = 'تعذر الاتصال بواتساب، حاول لاحقاً';
    throw err;
  }

  let body = null;
  try { body = await r.json(); } catch (_) {}

  if (!r.ok) {
    const metaErr = body && body.error ? body.error : {};
    const detail = metaErr.error_user_msg || metaErr.message || `HTTP ${r.status}`;
    const err = new Error(`Meta WhatsApp ${r.status}: ${detail}`);
    err.userMessage = metaErr.error_user_msg || 'تعذّر إرسال رسالة واتساب';
    err.status = r.status;
    err.metaCode = metaErr.code;
    throw err;
  }

  return body;
}

async function sendWhatsappOtp(phone, code) {
  const to = normalizePhone(phone);
  return metaCall({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: WA_OTP_TEMPLATE,
      language: { code: WA_OTP_LANG },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: String(code) }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [{ type: 'text', text: String(code) }],
        },
      ],
    },
  });
}

async function sendWhatsapp(phone, message) {
  const to = normalizePhone(phone);
  return metaCall({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { preview_url: false, body: String(message) },
  });
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

async function trySendWhatsappOtp(phone, code, tag = 'whatsapp-otp') {
  try {
    await sendWhatsappOtp(phone, code);
    return true;
  } catch (e) {
    console.error(`[${tag}] whatsapp otp send failed:`, e.message);
    return false;
  }
}

module.exports = {
  sendWhatsapp,
  trySendWhatsapp,
  sendWhatsappOtp,
  trySendWhatsappOtp,
};

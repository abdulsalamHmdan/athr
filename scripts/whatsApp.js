require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const PORT = process.env.WHATSAPP_PORT || 3100;
const API_KEY = process.env.WHATSAPP_API_KEY || '';
const COUNTRY_CODE = '966';
const PHONE_RE = /^5[0-9]{8}$/;

let waClient = null;
let waReady = false;

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let local = digits.startsWith('966') ? digits.slice(3) : digits;
  if (local.startsWith('0')) local = local.slice(1);
  return local;
}

async function sendWhatsappMessage(phone9, text) {
  if (!waClient || !waReady) throw new Error('WhatsApp client not ready');
  const chatId = `${COUNTRY_CODE}${phone9}@c.us`;
  await waClient.sendMessage(chatId, text);
}

function buildHttpServer() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    if (!API_KEY) return next();
    if (req.headers['x-api-key'] !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  app.post('/send', async (req, res) => {
    try {
      const phone = normalizePhone(req.body && req.body.phone);
      const message = req.body && req.body.message;
      if (!PHONE_RE.test(phone)) {
        return res.status(400).json({ error: 'رقم الجوال غير صحيح' });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'الرسالة مطلوبة' });
      }
      if (!waReady) {
        return res.status(503).json({ error: 'خدمة واتساب غير جاهزة' });
      }
      await sendWhatsappMessage(phone, message);
      return res.json({ ok: true });
    } catch (err) {
      console.error('send error:', err);
      return res.status(500).json({ error: 'فشل إرسال الرسالة' });
    }
  });

  app.get('/health', (req, res) => res.json({ ok: true, waReady }));

  return app;
}

async function main() {
  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: 'athr-points-bot' }),
    puppeteer: {
        args: ['--no-sandbox'],
        headless: false
    },
    // puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  waClient.on('qr', (qr) => {
    console.log('امسح رمز QR التالي من تطبيق واتساب:');
    qrcode.generate(qr, { small: true });
  });

  waClient.on('ready', () => {
    waReady = true;
    console.log('✅ خدمة واتساب جاهزة');
  });
  waClient.on('auth_failure', (m) => {
    waReady = false;
    console.error('auth failure:', m);
  });
  waClient.on('disconnected', (r) => {
    waReady = false;
    console.warn('disconnected:', r);
  });

  await waClient.initialize();

  const app = buildHttpServer();
  app.listen(PORT, () => console.log(`✅ خدمة واتساب تعمل على المنفذ ${PORT}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

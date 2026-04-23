require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Ambassador = require(path.join(__dirname, '..', 'models', 'Ambassador'));
const BASE_URL = process.env.PUBLIC_URL || 'sfeer.site';
const LOGIN_URL = `${BASE_URL}/r/`;
const SIGNUP_URL = `${BASE_URL}/signup`;
const RESET_PASSWORD = '1234';
// حالات المحادثة: chatId -> { step: 'awaitingResetChoice', ambassadorId }
const sessions = new Map();
// تحويل الرقم إلى صيغة قاعدة البيانات (9 أرقام بدون صفر/رمز الدولة)
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let local = digits.startsWith('966') ? digits.slice(3) : digits;
  if (local.startsWith('0')) local = local.slice(1);
  return local;
}

async function handleMessage(client, msg) {
  if (msg.from.endsWith('@g.us')) return; // تجاهل المجموعات
  if (msg.fromMe) return;
  const chatId = msg.from;
  const text = (msg.body || '').trim();
  let phone;
  const contact = await msg.getContact();
      if (contact && contact.number) {
        phone = normalizePhone(contact.number);
      }

  if (!phone) {
    console.log('تعذّر استخراج رقم الجوال للمرسل:', chatId);
    return;
  }
  const state = sessions.get(chatId);
  // إذا كان في انتظار طلب إعادة تعيين كلمة المرور


  if (state && state.step === 'awaitingResetChoice') {
    if (text === '1') {
      try {
        const hash = await bcrypt.hash(RESET_PASSWORD, 10);
        await Ambassador.updateOne({ _id: state.ambassadorId }, { $set: { password: hash } });
        await client.sendMessage(
          chatId,
          `✅ تم إعادة تعيين كلمة المرور.\nكلمة المرور الجديدة: *${RESET_PASSWORD}*\nيرجى تسجيل الدخول وتغييرها لاحقاً.`
        );
      } catch (err) {
        console.error('reset error:', err);
        await client.sendMessage(chatId, '⚠️ حدث خطأ أثناء إعادة تعيين كلمة المرور، حاول لاحقاً.');
      }
      sessions.delete(chatId);
      return;
    }
    // أي رد آخر — نتجاهله ونُنهي الحالة
    sessions.delete(chatId);
    return;
  }

  // محادثة جديدة — تحقق من وجود السفير
  try {
    const amb = await Ambassador.findOne({ phone });
    if (amb) {
      sessions.set(chatId, { step: 'awaitingResetChoice', ambassadorId: amb._id });
      await client.sendMessage(
        chatId,
        `مرحباً ${amb.name} 👋\nرابط تسجيل الدخول:\n${LOGIN_URL}${amb.referralCode}\n\nإذا كنت ترغب بإعادة تعيين كلمة المرور، أرسل الرقم *1*`
      );
    } else {
      console.log(`رقم ${phone} غير مسجل كسفير`);
    }
  } catch (err) {
    console.error('lookup error:', err);
  }
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI غير معرف في .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'athr-points-bot' }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  client.on('qr', (qr) => {
    console.log('امسح رمز QR التالي من تطبيق واتساب:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => console.log('✅ بوت واتساب جاهز'));
  client.on('auth_failure', (m) => console.error('auth failure:', m));
  client.on('disconnected', (r) => console.warn('disconnected:', r));
  client.on('message', (msg) => handleMessage(client, msg).catch((e) => console.error(e)));

  await client.initialize();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

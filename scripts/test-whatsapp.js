require('dotenv').config();
const path = require('path');
const { sendWhatsapp, sendWhatsappOtp } = require(path.join('..', 'services', 'whatsapp'));

function usage() {
  console.log(`
استخدام:
  node scripts/test-whatsapp.js text <phone> <message...>
  node scripts/test-whatsapp.js otp  <phone> <code>

أمثلة:
  node scripts/test-whatsapp.js text 0507499583 تجربة من السكربت
  node scripts/test-whatsapp.js otp  0507499583 123456

ملاحظات:
  - النص الحر يعمل فقط داخل نافذة 24 ساعة (أو لأرقام Test المسجلة في Meta).
  - OTP يحتاج قالب معتمد باسم WHATSAPP_OTP_TEMPLATE في .env.
`);
}

async function main() {
  const [mode, phone, ...rest] = process.argv.slice(2);
  if (!mode || !phone || rest.length === 0) {
    usage();
    process.exit(1);
  }

  try {
    let result;
    if (mode === 'text') {
      const message = rest.join(' ');
      console.log(`→ إرسال نص حر إلى ${phone}: "${message}"`);
      result = await sendWhatsapp(phone, message);
    } else if (mode === 'otp') {
      const code = rest[0];
      console.log(`→ إرسال OTP إلى ${phone} باستخدام القالب ${process.env.WHATSAPP_OTP_TEMPLATE || 'otp_athr'} / ${process.env.WHATSAPP_OTP_LANG || 'ar'}`);
      result = await sendWhatsappOtp(phone, code);
    } else {
      console.error(`نوع غير معروف: ${mode}`);
      usage();
      process.exit(1);
    }

    console.log('\n✅ نجح الإرسال');
    console.log('  wa_id     :', result?.contacts?.[0]?.wa_id);
    console.log('  message_id:', result?.messages?.[0]?.id);
  } catch (e) {
    console.error('\n❌ فشل الإرسال');
    console.error('  message    :', e.message);
    if (e.userMessage) console.error('  userMessage:', e.userMessage);
    if (e.metaCode)    console.error('  metaCode   :', e.metaCode);
    if (e.status)      console.error('  status     :', e.status);
    process.exit(2);
  }
}

main();

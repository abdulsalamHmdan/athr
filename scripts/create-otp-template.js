require('dotenv').config();

const WA_TOKEN       = process.env.WHATSAPP_TOKEN || '';
const WA_WABA_ID     = process.env.WHATSAPP_WABA_ID || '';
const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

const NAME     = process.argv[2] || process.env.WHATSAPP_OTP_TEMPLATE || 'otp_athr';
const LANG     = process.argv[3] || process.env.WHATSAPP_OTP_LANG     || 'ar';
const BTN_TEXT = process.argv[4] || 'نسخ الرمز';
const EXPIRES  = parseInt(process.argv[5] || '10', 10);

async function main() {
  if (!WA_TOKEN || !WA_WABA_ID) {
    console.error('❌ ينقص WHATSAPP_TOKEN أو WHATSAPP_WABA_ID في .env');
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${WA_API_VERSION}/${WA_WABA_ID}/message_templates`;

  const payload = {
    name: NAME,
    language: LANG,
    category: 'AUTHENTICATION',
    components: [
      {
        type: 'BODY',
        add_security_recommendation: true,
      },
      {
        type: 'FOOTER',
        code_expiration_minutes: EXPIRES,
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'OTP',
            otp_type: 'COPY_CODE',
            text: BTN_TEXT,
          },
        ],
      },
    ],
  };

  console.log('→ إنشاء قالب OTP');
  console.log('  name    :', NAME);
  console.log('  language:', LANG);
  console.log('  WABA    :', WA_WABA_ID);
  console.log('  button  :', BTN_TEXT, `(انتهاء ${EXPIRES} دقيقة)`);

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
    console.error('\n❌ تعذر الاتصال:', e.message);
    process.exit(2);
  }

  let body = null;
  try { body = await r.json(); } catch (_) {}

  if (!r.ok) {
    const err = body && body.error ? body.error : {};
    console.error('\n❌ فشل إنشاء القالب');
    console.error('  status     :', r.status);
    console.error('  code       :', err.code);
    console.error('  message    :', err.message);
    if (err.error_user_msg) console.error('  user_msg   :', err.error_user_msg);
    if (err.error_data)     console.error('  data       :', JSON.stringify(err.error_data));
    process.exit(2);
  }

  console.log('\n✅ تم الإرسال بنجاح للمراجعة من Meta');
  console.log('  id    :', body.id);
  console.log('  status:', body.status, '(عادة APPROVED خلال دقائق)');
  console.log('\nراقب الحالة:');
  console.log(`  node scripts/list-templates.js`);
}

main();

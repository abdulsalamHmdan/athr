require('dotenv').config();

const WA_TOKEN       = process.env.WHATSAPP_TOKEN || '';
const WA_WABA_ID     = process.env.WHATSAPP_WABA_ID || '';
const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

async function main() {
  if (!WA_TOKEN || !WA_WABA_ID) {
    console.error('❌ ينقص WHATSAPP_TOKEN أو WHATSAPP_WABA_ID في .env');
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${WA_API_VERSION}/${WA_WABA_ID}/message_templates?fields=name,language,status,category,id&limit=100`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
  const body = await r.json();

  if (!r.ok) {
    console.error('❌ خطأ:', JSON.stringify(body, null, 2));
    process.exit(2);
  }

  const rows = body.data || [];
  if (!rows.length) {
    console.log('لا توجد قوالب.');
    return;
  }

  console.log(`عدد القوالب: ${rows.length}\n`);
  for (const t of rows) {
    console.log(`• ${t.name}  [${t.language}]  ${t.status}  (${t.category})`);
    console.log(`  id: ${t.id}`);
  }
}

main();

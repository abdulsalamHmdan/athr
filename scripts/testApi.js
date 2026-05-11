require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../models/Fund');
const Ambassador = require('../models/Ambassador');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI غير معرف في .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const res = await fetch('https://donate.utq.org.sa/api/v1/goal/list?type=51', {
    method: 'get',
    headers: { k: 'ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ' },
  });
  const data = await res.json();
  const boxes = (data.results || []).filter((b) => b.client_id !== 1759);

  let created = 0;
  let skipped = 0;
  for (const b of boxes) {
    try {
      const ambassador = await Ambassador.findOne({
        platformProfileId: String(b.client_id),
      });
      if (!ambassador) {
        // console.log(`لا يوجد سفير لهذا client_id=${b.client_id} (box ${b.id})`);
        skipped++;
        continue;
      }

      const externalId = String(b.id);
      const exists = await Fund.findOne({ externalId });
      if (exists) {
        // console.log(`الصندوق موجود مسبقاً externalId=${externalId}`);
        skipped++;
        continue;
      }

      await Fund.create({
        ambassador: ambassador._id,
        name: b.name,
        targetAmount: Number(b.price_goal || 0),
        waqfType: String(b.prod_id || b.product_id || ''),
        ownerPhone: b.owner_phone || '',
        externalId,
      });
      created++;
      console.log(`تم إضافة الصندوق: ${b.name} للسفير ${ambassador.name}`);
    } catch (err) {
      console.error(`خطأ في الصندوق ${b.id}:`, err.message);
    }
  }

  console.log(`\nتم الانتهاء — أُضيف: ${created} | تم تخطي: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

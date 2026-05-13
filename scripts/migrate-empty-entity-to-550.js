require('dotenv').config();
const mongoose = require('mongoose');
const Ambassador = require('../models/Ambassador');
const { ENTITIES } = require('../services/entities');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI غير معرف في .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const validIds = Object.keys(ENTITIES);

  // تفصيل القيم اللي بتتأثر قبل التحديث
  const breakdown = await Ambassador.aggregate([
    { $match: { entity: { $nin: validIds } } },
    { $group: { _id: '$entity', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  if (!breakdown.length) {
    console.log('لا يوجد سفراء بقيمة entity غير معتمدة. لا شيء للتحديث.');
    await mongoose.disconnect();
    return;
  }

  console.log('قيم entity غير المعتمدة (قبل التحديث):');
  let total = 0;
  for (const row of breakdown) {
    const label = row._id === null ? '(null)' : row._id === '' ? '(فارغ)' : `"${row._id}"`;
    console.log(`  - ${label} → ${row.count} سفير`);
    total += row.count;
  }
  console.log(`الإجمالي: ${total} سفير سيتم تحويلهم إلى '550'\n`);

  const result = await Ambassador.updateMany(
    { entity: { $nin: validIds } },
    { $set: { entity: '550' } }
  );

  console.log('تم:', { matched: result.matchedCount, modified: result.modifiedCount });
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

require('dotenv').config();
const mongoose = require('mongoose');
const Ambassador = require('../models/Ambassador');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await Ambassador.updateMany(
    { $or: [{ entity: '' }, { entity: null }, { entity: { $exists: false } }] },
    { $set: { entity: '550' } }
  );
  console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

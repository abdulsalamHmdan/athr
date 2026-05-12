require('dotenv').config();
const mongoose = require('mongoose');
const Ambassador = require('../models/Ambassador');
const { syncAmbassador } = require('../services/platformSync');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const all = await Ambassador.find({});
  console.log(`[sync-all] ambassadors: ${all.length}`);

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < all.length; i++) {
    const amb = all[i];
    try {
      await syncAmbassador(amb);
      ok++;
      console.log(`[${i + 1}/${all.length}] ok  ${amb.phone}  total=${amb.totalDonations}  orders=${amb.orderCount}`);
    } catch (e) {
      failed++;
      console.error(`[${i + 1}/${all.length}] FAIL ${amb.phone}  ${e.message}`);
    }
  }

  console.log(`[sync-all] done. ok=${ok} failed=${failed}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

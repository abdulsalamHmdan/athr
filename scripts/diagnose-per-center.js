require('dotenv').config();
const mongoose = require('mongoose');
const Ambassador = require('../models/Ambassador');
const AllFund = require('../models/AllFund');
const { ENTITIES } = require('../services/entities');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI غير معرف في .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const ambs = await Ambassador.find({}, 'entity platformProfileId name phone').lean();
  const ambByProfile = new Map();
  for (const a of ambs) {
    const cid = Number(a.platformProfileId);
    if (Number.isFinite(cid) && cid > 0) {
      if (!ambByProfile.has(cid)) ambByProfile.set(cid, []);
      ambByProfile.get(cid).push(a);
    }
  }

  const profileIds = [...ambByProfile.keys()];
  const fundsList = await AllFund.find(
    { client_id: { $in: profileIds } },
    'client_id currentTotal'
  ).lean();

  const totalsByClient = new Map();
  const activeCountByClient = new Map();
  const allCountByClient = new Map();
  for (const f of fundsList) {
    const cid = Number(f.client_id);
    const amount = Number(f.currentTotal) || 0;
    totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
    allCountByClient.set(cid, (allCountByClient.get(cid) || 0) + 1);
    if (amount > 0) {
      activeCountByClient.set(cid, (activeCountByClient.get(cid) || 0) + 1);
    }
  }

  // بناء إحصاء كل مجمع
  const rows = [];
  for (const [id, name] of Object.entries(ENTITIES)) {
    const entAmbs = ambs.filter((a) => String(a.entity || '') === id);
    let ambsWithProfile = 0;
    let allFunds = 0;
    let activeFunds = 0;
    let donations = 0;
    for (const a of entAmbs) {
      const cid = Number(a.platformProfileId);
      if (!Number.isFinite(cid) || cid <= 0) continue;
      ambsWithProfile++;
      allFunds += allCountByClient.get(cid) || 0;
      activeFunds += activeCountByClient.get(cid) || 0;
      donations += totalsByClient.get(cid) || 0;
    }
    rows.push({
      id,
      name,
      ambs: entAmbs.length,
      ambsWithProfile,
      ambsNoProfile: entAmbs.length - ambsWithProfile,
      allFunds,
      activeFunds,
      donations,
    });
  }

  rows.sort((a, b) => b.activeFunds - a.activeFunds);

  console.log('\n=== توزيع الأرقام لكل مجمع (مرتبة حسب الصناديق النشطة) ===\n');
  console.log(
    'الجهة'.padEnd(28) +
      ' | ' +
      'سفراء'.padStart(6) +
      ' | ' +
      'له profile'.padStart(10) +
      ' | ' +
      'بدون'.padStart(6) +
      ' | ' +
      'كل الصناديق'.padStart(12) +
      ' | ' +
      'نشطة'.padStart(6) +
      ' | ' +
      'التبرعات'.padStart(12)
  );
  console.log('-'.repeat(110));

  let sumAmbs = 0;
  let sumProfile = 0;
  let sumNoProfile = 0;
  let sumAllFunds = 0;
  let sumActiveFunds = 0;
  let sumDonations = 0;
  for (const r of rows) {
    console.log(
      r.name.padEnd(28) +
        ' | ' +
        String(r.ambs).padStart(6) +
        ' | ' +
        String(r.ambsWithProfile).padStart(10) +
        ' | ' +
        String(r.ambsNoProfile).padStart(6) +
        ' | ' +
        String(r.allFunds).padStart(12) +
        ' | ' +
        String(r.activeFunds).padStart(6) +
        ' | ' +
        r.donations.toLocaleString('en-US').padStart(12)
    );
    sumAmbs += r.ambs;
    sumProfile += r.ambsWithProfile;
    sumNoProfile += r.ambsNoProfile;
    sumAllFunds += r.allFunds;
    sumActiveFunds += r.activeFunds;
    sumDonations += r.donations;
  }

  console.log('-'.repeat(110));
  console.log(
    'الإجمالي'.padEnd(28) +
      ' | ' +
      String(sumAmbs).padStart(6) +
      ' | ' +
      String(sumProfile).padStart(10) +
      ' | ' +
      String(sumNoProfile).padStart(6) +
      ' | ' +
      String(sumAllFunds).padStart(12) +
      ' | ' +
      String(sumActiveFunds).padStart(6) +
      ' | ' +
      sumDonations.toLocaleString('en-US').padStart(12)
  );

  console.log('\nتفسير الأعمدة:');
  console.log('  - سفراء: عدد السفراء المنتمين لهذه الجهة.');
  console.log('  - له profile: عددهم اللي عنده platformProfileId صالح (وهؤلاء فقط تظهر صناديقهم).');
  console.log('  - بدون: عدد السفراء بدون platformProfileId — صناديقهم لا تظهر إطلاقاً.');
  console.log('  - كل الصناديق: مجموع صناديق هؤلاء السفراء في AllFund (حتى الفارغة).');
  console.log('  - نشطة: من ضمنها currentTotal > 0.');
  console.log('  - التبرعات: مجموع currentTotal لصناديقهم.');

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });

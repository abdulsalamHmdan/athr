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
  console.log('MongoDB connected\n');

  const line = (label, value) => console.log(`${label.padEnd(55, '.')} ${value}`);
  const section = (title) => console.log(`\n=== ${title} ===`);

  // ---------- السفراء ----------
  section('السفراء');
  const totalAmb = await Ambassador.countDocuments({});
  line('إجمالي السفراء في DB', totalAmb);

  const ambs = await Ambassador.find({}, 'entity platformProfileId').lean();

  const ambsWithProfile = ambs.filter(
    (a) => a.platformProfileId != null && a.platformProfileId !== ''
  );
  const ambsWithNumericProfile = ambs.filter((a) => {
    const n = Number(a.platformProfileId);
    return Number.isFinite(n) && n > 0;
  });
  line('السفراء عندهم platformProfileId (غير فاضي)', ambsWithProfile.length);
  line('السفراء عندهم platformProfileId رقم صالح > 0', ambsWithNumericProfile.length);
  line('السفراء بدون platformProfileId (null/فارغ)', totalAmb - ambsWithProfile.length);

  // التصنيف حسب entity
  const entityIds = new Set(Object.keys(ENTITIES));
  const inEntity = ambs.filter((a) => entityIds.has(String(a.entity || ''))).length;
  const outEntity = totalAmb - inEntity;
  line('السفراء entity عندهم في القائمة المعتمدة', inEntity);
  line('السفراء entity عندهم غير معتمد/فارغ', outEntity);

  // تفصيل entity غير معتمد
  const otherEntities = {};
  for (const a of ambs) {
    const e = String(a.entity || '');
    if (!entityIds.has(e)) {
      otherEntities[e || '(فارغ)'] = (otherEntities[e || '(فارغ)'] || 0) + 1;
    }
  }
  const sortedOthers = Object.entries(otherEntities).sort((a, b) => b[1] - a[1]);
  if (sortedOthers.length) {
    console.log('\n  تفصيل قيم entity غير المعتمدة:');
    for (const [val, count] of sortedOthers) {
      console.log(`    - "${val}" → ${count} سفير`);
    }
  }

  // ---------- AllFund ----------
  section('AllFund (الصناديق)');
  const totalFunds = await AllFund.countDocuments({});
  const activeFunds = await AllFund.countDocuments({ currentTotal: { $gt: 0 } });
  line('إجمالي مستندات AllFund', totalFunds);
  line('الصناديق النشطة (currentTotal > 0) كلّياً', activeFunds);
  line('الصناديق بدون تبرعات (currentTotal = 0)', totalFunds - activeFunds);

  const distinctClientIds = await AllFund.distinct('client_id');
  line('عدد client_id المميّزة في AllFund', distinctClientIds.length);

  const distinctActiveClientIds = await AllFund.distinct('client_id', {
    currentTotal: { $gt: 0 },
  });
  line('عدد client_id المميّزة في الصناديق النشطة', distinctActiveClientIds.length);

  // ---------- التقاطع ----------
  section('التقاطع: صناديق مرتبطة بسفراء فعلاً');
  const ambProfileIds = new Set(
    ambsWithNumericProfile.map((a) => Number(a.platformProfileId))
  );
  line('عدد platformProfileId الفريدة عند السفراء', ambProfileIds.size);

  const matchedClientIds = distinctClientIds.filter((cid) =>
    ambProfileIds.has(Number(cid))
  );
  const orphanClientIds = distinctClientIds.filter(
    (cid) => !ambProfileIds.has(Number(cid))
  );
  line('client_id يطابق سفير', matchedClientIds.length);
  line('client_id يتيم (مالها سفير في DB)', orphanClientIds.length);

  const fundsLinkedToAmb = await AllFund.countDocuments({
    client_id: { $in: [...ambProfileIds] },
  });
  const activeFundsLinkedToAmb = await AllFund.countDocuments({
    client_id: { $in: [...ambProfileIds] },
    currentTotal: { $gt: 0 },
  });
  line('صناديق client_id عندها يطابق سفير', fundsLinkedToAmb);
  line('من ضمنها: نشطة (currentTotal > 0)', activeFundsLinkedToAmb);

  const fundsOrphan = totalFunds - fundsLinkedToAmb;
  const activeFundsOrphan = activeFunds - activeFundsLinkedToAmb;
  line('صناديق يتيمة (مالها سفير)', fundsOrphan);
  line('من ضمنها: نشطة', activeFundsOrphan);

  // ---------- محاكاة منطق /public/centers ----------
  section('محاكاة الحساب الفعلي في /api/public/centers');
  const fundsList = await AllFund.find(
    { client_id: { $in: [...ambProfileIds] } },
    'client_id currentTotal'
  ).lean();

  const totalsByClient = new Map();
  const countByClient = new Map();
  for (const f of fundsList) {
    const cid = Number(f.client_id);
    const amount = Number(f.currentTotal) || 0;
    totalsByClient.set(cid, (totalsByClient.get(cid) || 0) + amount);
    if (amount > 0) {
      countByClient.set(cid, (countByClient.get(cid) || 0) + 1);
    }
  }

  let sumAmb = 0;
  let sumFundsActive = 0;
  let sumDonations = 0;
  for (const e of Object.keys(ENTITIES)) {
    const entAmbs = ambs.filter((a) => String(a.entity || '') === e);
    sumAmb += entAmbs.length;
    for (const a of entAmbs) {
      const cid = Number(a.platformProfileId);
      if (!Number.isFinite(cid)) continue;
      sumFundsActive += countByClient.get(cid) || 0;
      sumDonations += totalsByClient.get(cid) || 0;
    }
  }
  line('مجموع السفراء كما يظهر في /centers', sumAmb);
  line('مجموع الصناديق النشطة كما يظهر في /centers', sumFundsActive);
  line('مجموع التبرعات كما يظهر في /centers', sumDonations.toLocaleString('en-US'));

  // ---------- ملخص ----------
  section('الخلاصة');
  console.log(`- DB فيها ${totalAmb} سفير، يظهر منهم ${sumAmb} في /centers (فرق ${totalAmb - sumAmb}).`);
  console.log(`- DB فيها ${totalFunds} صندوق، نشط منهم ${activeFunds}.`);
  console.log(`- يظهر في /centers ${sumFundsActive} صندوق نشط فقط.`);
  console.log(`- ${activeFundsOrphan} صندوق نشط يتيم (client_id ما له سفير في DB).`);
  console.log(`- ${orphanClientIds.length} client_id في AllFund ما له سفير مطابق.`);

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});

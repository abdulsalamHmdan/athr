const { configDotenv } = require("dotenv");
configDotenv();
const path = require("path");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const Ambassador = require("../models/Ambassador");
const BonusPoints = require("../models/BonusPoints");

const GOALS_API = "https://donate.utq.org.sa/api/v1/orders/report/goals";
// تاريخ بداية ونهاية الحملة (Unix timestamp)
const CAMPAIGN_START_TS = 1779742800;
const CAMPAIGN_END_TS = 1779829200;
// مسمى النقاط الإضافية
const BONUS_REASON = "نقاط عرفة";

// جلب كل ال items مرة واحدة (مع الترقيم) بدون goal_creator
async function fetchAllItems() {
  const items = [];
  const ts = `${CAMPAIGN_START_TS}-${CAMPAIGN_END_TS}`;
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const url = `${GOALS_API}?page=${page}&ts=${ts}`;
    const res = await fetch(url, {
      method: "get",
      headers: { k: process.env.DONATE_API_KEY },
    });
    const data = await res.json();
    hasMore = Boolean(data.hasMore);
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push(...batch);
    console.log(`page ${page} -> items: ${batch.length} (تراكمي: ${items.length})`);
    page++;
  }
  return items;
}

// تجميع المجاميع حسب goal_creator
function aggregateByCreator(items) {
  const totals = new Map();
  for (const it of items) {
    const cid = Number(it.goal_creator);
    if (!cid) continue;
    totals.set(cid, (totals.get(cid) || 0) + (Number(it.total) || 0));
  }
  return totals;
}

async function extract() {
  const [items, ambassadors] = await Promise.all([
    fetchAllItems(),
    Ambassador.find({}).lean(),
  ]);

  const totalsByCreator = aggregateByCreator(items);
  console.log(
    `السفراء: ${ambassadors.length} | عملاء لديهم مبالغ: ${totalsByCreator.size}`
  );

  // الربط مع السفراء عبر platformProfileId == goal_creator
  const rows = ambassadors.map((amb) => {
    const cid = amb.platformProfileId ? Number(amb.platformProfileId) : null;
    const total = (cid && totalsByCreator.get(cid)) || 0;
    return {
      ambassadorId: amb._id,
      name: amb.name || "",
      total: Math.round(total),
    };
  });

  // ترتيب تنازلي حسب المجموع
  rows.sort((a, b) => b.total - a.total);

  // إضافة سجلات نقاط إضافية لكل سفير عنده نقاط (سجل جديد في كل تشغيل)
  const bonusDocs = rows
    .filter((r) => r.total > 0)
    .map((r) => ({
      ambassador: r.ambassadorId,
      amount: r.total,
      reason: BONUS_REASON,
      addedBy: null,
    }));

  if (bonusDocs.length) {
    await BonusPoints.insertMany(bonusDocs);
    console.log(`تمت إضافة ${bonusDocs.length} سجل نقاط إضافية بمسمى "${BONUS_REASON}"`);
  } else {
    console.log("لا يوجد سفراء لديهم نقاط لإضافتها");
  }

  // إخراج ملف اكسل
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("مجاميع السفراء");
  sheet.views = [{ rightToLeft: true }];

  sheet.columns = [
    { header: "اسم السفير", key: "name", width: 32 },
    { header: "المجموع", key: "total", width: 18 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

  rows.forEach((r) => sheet.addRow(r));

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const totalRow = sheet.addRow({ name: "الإجمالي الكلي", total: grandTotal });
  totalRow.font = { bold: true };

  sheet.getColumn("total").numFmt = "#,##0";

  const outPath = path.join(__dirname, "..", "ambassadors-totals2.xlsx");
  await workbook.xlsx.writeFile(outPath);
  console.log(`تم إنشاء الملف: ${outPath}`);
  console.log(`الإجمالي الكلي للتبرعات: ${grandTotal.toLocaleString()}`);
}

if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("MongoDB connected");
      await extract();
    } catch (err) {
      console.error(err);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = extract;

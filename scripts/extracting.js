const { configDotenv } = require("dotenv");
configDotenv();
const path = require("path");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const AllFund = require("../models/AllFund");
const Ambassador = require("../models/Ambassador");

async function extract() {
  // 1) جلب جميع الصناديق وجميع السفراء
  const [funds, ambassadors] = await Promise.all([
    AllFund.find({}).lean(),
    Ambassador.find({}).lean(),
  ]);

  console.log(`الصناديق: ${funds.length} | السفراء: ${ambassadors.length}`);

  // 2) تجميع مجاميع الصناديق حسب client_id (مفتاح الربط)
  const totalsByClient = new Map();
  for (const f of funds) {
    const cid = Number(f.client_id);
    if (!cid) continue;
    const cur = totalsByClient.get(cid) || { total: 0, grandTotal: 0, orderCount: 0, boxes: 0 };
    cur.total += Number(f.currentTotal) || 0;
    cur.grandTotal += Number(f.total) || 0;
    cur.orderCount += (Number(f.currentTotal) || 0) > 0 ? Number(f.orderCount) || 0 : 0;
    cur.boxes += 1;
    totalsByClient.set(cid, cur);
  }

  // 3) الجوين مع السفراء عبر platformProfileId == client_id
  const rows = ambassadors.map((amb) => {
    const cid = amb.platformProfileId ? Number(amb.platformProfileId) : null;
    const agg = (cid && totalsByClient.get(cid)) || { total: 0, grandTotal: 0, orderCount: 0, boxes: 0 };
    return {
      name: amb.name || "",
      phone: amb.phone || "",
      entity: amb.entity || "",
      isMember: amb.isMember ? "نعم" : "لا",
      platformProfileId: amb.platformProfileId || "",
      boxes: agg.boxes,
      orderCount: agg.orderCount,
      total: Math.round(agg.total),
      grandTotal: Math.round(agg.grandTotal),
    };
  });

  // ترتيب تنازلي حسب المجموع
  rows.sort((a, b) => b.total - a.total);

  // 4) إخراج ملف اكسل
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("مجاميع السفراء");
  sheet.views = [{ rightToLeft: true }];

  sheet.columns = [
    { header: "اسم السفير", key: "name", width: 28 },
    { header: "الجوال", key: "phone", width: 16 },
    { header: "الجهة", key: "entity", width: 12 },
    { header: "عضو", key: "isMember", width: 8 },
    { header: "معرف المنصة", key: "platformProfileId", width: 16 },
    { header: "عدد الصناديق", key: "boxes", width: 14 },
    { header: "عدد الطلبات", key: "orderCount", width: 14 },
    { header: "إجمالي التبرعات", key: "total", width: 18 },
    { header: "المجموع الكلي", key: "grandTotal", width: 18 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

  rows.forEach((r) => sheet.addRow(r));

  // صف المجموع الكلي
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandTotalAll = rows.reduce((s, r) => s + r.grandTotal, 0);
  const totalRow = sheet.addRow({ name: "الإجمالي الكلي", total: grandTotal, grandTotal: grandTotalAll });
  totalRow.font = { bold: true };

  sheet.getColumn("total").numFmt = "#,##0";
  sheet.getColumn("grandTotal").numFmt = "#,##0";
  sheet.getColumn("orderCount").numFmt = "#,##0";

  const outPath = path.join(__dirname, "..", "ambassadors-totals.xlsx");
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

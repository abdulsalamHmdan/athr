const { configDotenv } = require("dotenv");
configDotenv();
const path = require("path");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const AllFund = require("../models/AllFund");
const Ambassador = require("../models/Ambassador");

// تحويل حالة الصندوق إلى نص مقروء
function statusLabel(done) {
  switch (done) {
    case "a":
      return "مكتمل";
    case "b":
      return "جاري";
    case "c":
      return "لم يبدأ";
    default:
      return done || "";
  }
}

async function extract() {
  // جلب جميع الصناديق وجميع السفراء
  const [funds, ambassadors] = await Promise.all([
    AllFund.find({}).lean(),
    Ambassador.find({}).lean(),
  ]);

  console.log(`الصناديق: ${funds.length} | السفراء: ${ambassadors.length}`);

  // خريطة السفراء حسب معرف المنصة (client_id) لتحديد صاحب الصندوق وجواله
  const ambByClient = new Map();
  for (const a of ambassadors) {
    if (a.platformProfileId) ambByClient.set(Number(a.platformProfileId), a);
  }

  // صف لكل صندوق مع جميع البيانات + صاحب الصندوق عبر رقم الجوال
  const rows = funds.map((f) => {
    const owner = ambByClient.get(Number(f.client_id)) || null;
    const stats = f.stats || {};
    return {
      id: f.id,
      name: f.name || "",
      ownerName: owner ? owner.name : "",
      ownerPhone: owner ? owner.phone : (f.phone || ""),
      clientId: f.client_id || "",
      status: statusLabel(f.done),
      priceGoal: Number(f.price_goal) || 0,
      currentTotal: Number(f.currentTotal) || 0,
      total: Number(f.total) || 0,
      orderCount: Number(f.orderCount) || 0,
      progress: Number(stats.progress) || 0,
      visits: Number(stats.visits) || 0,
      type: f.type || "",
      prodId: f.prod_id || "",
      createdAt: f.createdAt ? new Date(f.createdAt) : null,
      updatedAt: f.updatedAt ? new Date(f.updatedAt) : null,
    };
  });

  // ترتيب تنازلي حسب الإجمالي الحالي
  rows.sort((a, b) => b.currentTotal - a.currentTotal);

  // إخراج ملف اكسل
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("الصناديق");
  sheet.views = [{ rightToLeft: true }];

  sheet.columns = [
    { header: "رقم الصندوق", key: "id", width: 12 },
    { header: "اسم الصندوق", key: "name", width: 32 },
    { header: "صاحب الصندوق", key: "ownerName", width: 24 },
    { header: "جوال صاحب الصندوق", key: "ownerPhone", width: 18 },
    { header: "معرف المنصة", key: "clientId", width: 14 },
    { header: "الحالة", key: "status", width: 12 },
    { header: "الهدف", key: "priceGoal", width: 12 },
    { header: "التبرعات الحالية", key: "currentTotal", width: 16 },
    { header: "الإجمالي الكلي", key: "total", width: 16 },
    { header: "عدد الطلبات", key: "orderCount", width: 12 },
    { header: "نسبة الإنجاز %", key: "progress", width: 14 },
    { header: "الزيارات", key: "visits", width: 10 },
    { header: "النوع", key: "type", width: 8 },
    { header: "المنتج", key: "prodId", width: 8 },
    { header: "تاريخ الإنشاء", key: "createdAt", width: 20 },
    { header: "آخر تحديث", key: "updatedAt", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

  rows.forEach((r) => sheet.addRow(r));

  // تنسيق الأرقام والتواريخ
  sheet.getColumn("priceGoal").numFmt = "#,##0";
  sheet.getColumn("currentTotal").numFmt = "#,##0";
  sheet.getColumn("total").numFmt = "#,##0";
  sheet.getColumn("orderCount").numFmt = "#,##0";
  sheet.getColumn("progress").numFmt = "0.00";
  sheet.getColumn("createdAt").numFmt = "yyyy-mm-dd hh:mm";
  sheet.getColumn("updatedAt").numFmt = "yyyy-mm-dd hh:mm";

  const outPath = path.join(__dirname, "..", "funds-export.xlsx");
  await workbook.xlsx.writeFile(outPath);
  console.log(`تم إنشاء الملف: ${outPath}`);
  console.log(`عدد الصناديق المصدّرة: ${rows.length}`);
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

// كتالوج الجوائز من قاعدة البيانات — بديل ملف public/data/prizes3.json.
// عند أول تشغيل بعد الترقية تُعبّأ المجموعة تلقائياً من الملف القديم.

const fs = require('fs');
const path = require('path');
const Prize = require('../models/Prize');

const LEGACY_JSON = path.join(__dirname, '..', 'public', 'data', 'prizes3.json');

// ترتيب عرض الفئات في المتجر
const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, diamond: 3 };

// الكتالوج العام (الجوائز الفعالة فقط) بنفس شكل الملف القديم { prizes: [...] }
async function getCatalog() {
  const rows = await Prize.find({ active: true }).lean();
  rows.sort(
    (a, b) =>
      (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) ||
      (a.order || 0) - (b.order || 0) ||
      String(a.key).localeCompare(String(b.key))
  );
  return rows.map((p) => ({
    id: p.key,
    name: p.name,
    description: p.description || '',
    image: p.image || '',
    tier: p.tier,
    stock: Number(p.stock) || 0,
    pointCost: p.pointCost || ({ bronze: 1000, silver: 3000, gold: 5000, diamond: 10000 }[p.tier]),
  }));
}

// تعبئة قاعدة البيانات من الملف القديم إذا كانت المجموعة فارغة (مرة واحدة)
async function seedFromLegacyJsonIfEmpty() {
  const count = await Prize.estimatedDocumentCount();
  if (count > 0) return { seeded: false, count };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8'));
  } catch (e) {
    console.error('[prizeCatalog] failed to read legacy prizes3.json:', e.message);
    return { seeded: false, count: 0 };
  }

  const prizes = Array.isArray(parsed?.prizes) ? parsed.prizes : [];
  if (!prizes.length) return { seeded: false, count: 0 };

  const docs = prizes
    .filter((p) => p && p.id && p.name && p.tier)
    .map((p, i) => ({
      key: String(p.id).trim(),
      name: String(p.name).trim(),
      description: String(p.description || '').trim(),
      image: String(p.image || '').trim(),
      tier: String(p.tier).trim(),
      stock: Math.max(0, Number(p.stock) || 0),
      active: true,
      order: i,
    }));

  try {
    await Prize.insertMany(docs, { ordered: false });
    console.log(`[prizeCatalog] seeded ${docs.length} prizes from prizes3.json`);
    return { seeded: true, count: docs.length };
  } catch (e) {
    console.error('[prizeCatalog] seeding failed:', e.message);
    return { seeded: false, count: 0 };
  }
}

module.exports = { getCatalog, seedFromLegacyJsonIfEmpty };

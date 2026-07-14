const mongoose = require('mongoose');

// جائزة في متجر الجوائز — كانت في public/data/prizes3.json وانتقلت لقاعدة البيانات.
// key هو المعرف العام (b1, s3, g5...) نفسه المحفوظ في PrizeRequest.prizeId.
const PrizeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    image: { type: String, default: '', trim: true, maxlength: 500 },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'diamond'],
      required: true,
      index: true,
    },
    stock: { type: Number, default: 0, min: 0 },
    // إخفاء الجائزة من المتجر دون حذف سجلها
    active: { type: Boolean, default: true },
    // ترتيب العرض داخل المتجر (الأصغر أولاً)
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prize', PrizeSchema);

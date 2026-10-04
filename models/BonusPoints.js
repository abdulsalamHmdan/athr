const mongoose = require('mongoose');

const BonusPointsSchema = new mongoose.Schema(
  {
    ambassador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambassador',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    reason: { type: String, default: '', trim: true, maxlength: 300 },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    // مصدر النقاط: admin = أضافها المشرف، pass = مكافأة خريطة الرحلة من التطبيق
    source: { type: String, enum: ['admin', 'pass', 'competition', 'mission'], default: 'admin' },
    // معرف مرحلة خريطة الرحلة (box-1..15 / ring-1..3 / complex) — يمنع تكرار الاستلام
    reference: { type: String },
    passNodeId: { type: String, default: null },
  },
  { timestamps: true }
);

BonusPointsSchema.index({ createdAt: -1 });
// استلام واحد لكل مرحلة لكل سفير
BonusPointsSchema.index(
  { ambassador: 1, passNodeId: 1 },
  { unique: true, partialFilterExpression: { passNodeId: { $type: 'string' } } }
);

BonusPointsSchema.index({ ambassador: 1, reference: 1 }, { unique: true, partialFilterExpression: { reference: { $type: 'string' } } });

module.exports = mongoose.model('BonusPoints', BonusPointsSchema);

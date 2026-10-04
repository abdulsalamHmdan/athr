const mongoose = require('mongoose');

const PrizeRequestSchema = new mongoose.Schema(
  {
    ambassador: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true },
    idempotencyKey: { type: String },
    shippingAddress: { type: String, default: '', maxlength: 1000 },
    amount: { type: Number, required: true },
    // معرف التصنيف وقت الطلب (bronze/silver/gold/diamond) — الطلبات الأقدم بدونه
    tier: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
    note: { type: String, default: '' },
    prizeId: { type: String, default: '' },
    prizeName: { type: String, default: '' },
  },
  { timestamps: true }
);

PrizeRequestSchema.index({ ambassador: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

module.exports = mongoose.model('PrizeRequest', PrizeRequestSchema);

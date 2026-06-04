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
  },
  { timestamps: true }
);

BonusPointsSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BonusPoints', BonusPointsSchema);

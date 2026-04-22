const mongoose = require('mongoose');

const FundSchema = new mongoose.Schema(
  {
    ambassador: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    waqfType: { type: String, required: true },
    acceptAfterTarget: { type: Boolean, default: false },
    phone: { type: String, default: '' },
    ownerPhone: { type: String, default: '' },
    externalId: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fund', FundSchema);

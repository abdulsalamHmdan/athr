const mongoose = require('mongoose');

const PrizeRequestSchema = new mongoose.Schema(
  {
    ambassador: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PrizeRequest', PrizeRequestSchema);

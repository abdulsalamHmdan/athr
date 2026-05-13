const mongoose = require('mongoose');

const AllFundSchema = new mongoose.Schema(
  {
    id: { type: Number, index: true, unique: true },
    name: { type: String, default: '' },
    price_goal: { type: Number, default: 0 },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    client_id: { type: Number, default: null },
    prod_id: { type: Number, default: null },
    type: { type: Number, default: null },
    total: { type: Number, default: 0 },
    currentTotal: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    done: { type: String, default: 'c' },
    phone: { type: String, default: '' }
  },
  { timestamps: true, collection: 'all-funds' }
);

module.exports = mongoose.model('AllFund', AllFundSchema);

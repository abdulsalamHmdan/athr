const mongoose = require('mongoose');

const AmbassadorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isMember: { type: Boolean, default: false },
    entity: { type: String, default: '' },
    referralCode: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ambassador', AmbassadorSchema);

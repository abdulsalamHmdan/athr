const mongoose = require('mongoose');

const AmbassadorSchema = new mongoose.Schema(
  {
    atharRevision: { type: Number, default: 0 },
    appSuspended: { type: Boolean, default: false },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isMember: { type: Boolean, default: false },
    entity: { type: String, default: '0' },
    referralCode: { type: String, required: true, unique: true },
    platformProfileId: { type: String, default: null, unique: true, sparse: true },
    totalDonations: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    donationsUpdatedAt: { type: Date, default: null },
    resetOtp: { type: String, default: null },
    resetOtpExpires: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ambassador', AmbassadorSchema);

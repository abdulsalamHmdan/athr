const mongoose = require('mongoose');

const PushSubscriptionSchema = new mongoose.Schema(
  {
    ambassador: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);

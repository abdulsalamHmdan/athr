const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    url: { type: String, default: '' },
    target: { type: String, enum: ['all', 'ambassador'], default: 'all' },
    ambassador: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', default: null },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', NotificationSchema);

const mongoose = require('mongoose');

const AmbassadorActivitySchema = new mongoose.Schema(
  {
    ambassador: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    source: { type: String, default: 'client', trim: true, maxlength: 30 },
    path: { type: String, default: '', trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

AmbassadorActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('AmbassadorActivity', AmbassadorActivitySchema);

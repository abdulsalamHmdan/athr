const mongoose = require('mongoose');

const SyncMetaSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    lastSyncAt: { type: Date, default: null },
    lastUpdateTs: { type: Number, default: 0 },
  },
  { collection: 'sync-meta', timestamps: true }
);

module.exports = mongoose.model('SyncMeta', SyncMetaSchema);

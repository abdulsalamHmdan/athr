const mongoose = require('mongoose');

const SyncMetaSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    lastSyncAt: { type: Date, default: null },
  },
  { collection: 'sync-meta', timestamps: true }
);

module.exports = mongoose.model('SyncMeta', SyncMetaSchema);

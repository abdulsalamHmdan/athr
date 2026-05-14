const { configDotenv } = require("dotenv");
configDotenv();
const mongoose = require("mongoose");
const syncFunds = require("./testing3");
const syncFundTotals = require("./testing4");
const SyncMeta = require("../models/SyncMeta");

async function syncAll() {
  console.log("[sync] testing3: syncFunds ...");
  await syncFunds();
  console.log("[sync] testing4: syncFundTotals ...");
  await syncFundTotals();
  await SyncMeta.updateOne(
    { key: "funds" },
    { $set: { lastSyncAt: new Date() } },
    { upsert: true }
  );
  console.log("[sync] done");
}

if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("MongoDB connected");
      await syncAll();
    } catch (err) {
      console.error(err);
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = syncAll;

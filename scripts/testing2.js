const { configDotenv } = require("dotenv");
configDotenv();
const mongoose = require("mongoose");
const AllFund = require("../models/AllFund");
const SyncMeta = require("../models/SyncMeta");

const SYNC_KEY = "fund-totals";

async function syncFundTotals() {
  const meta = await SyncMeta.findOne({ key: SYNC_KEY }).lean();
  const lastupdate = meta && meta.lastUpdateTs ? meta.lastUpdateTs : 1777150800;
  const updatingDate = Math.ceil(Date.now() / 1000);
  console.log(`[sync] ts range: ${lastupdate}-${updatingDate}`);
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    console.log(`--- Page ${page} ---`);
    const res = await fetch(
      `https://donate.utq.org.sa/api/v1/orders/report/goals?page=${page}&ts=${lastupdate}-${updatingDate}`,
      {
        method: "get",
        headers: { k: process.env.DONATE_API_KEY },
      }
    );
    const json = await res.json();
    hasMore = Boolean(json.hasMore);

    const results = Array.isArray(json.items) ? json.items : [];
    const now = new Date();

    const ops = results.map((g) => ({
      updateOne: {
        filter: { id: Number(g.pk), client_id: Number(g.goal_creator) },
        update: {
          $set: {
            currentTotal: Number(g.total) || 0,
            orderCount: Number(g.order_count) || 0,
            updatedAt: now,
          },
        },
      },
    }));

    if (ops.length) {
      const result = await AllFund.bulkWrite(ops, { timestamps: false });
      console.log("Updated funds:", {
        page,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        total: results.length,
      });
    } else {
      console.log("No results returned from API for page", page);
    }
    page++;
  }

  await SyncMeta.updateOne(
    { key: SYNC_KEY },
    { $set: { lastUpdateTs: updatingDate } },
    { upsert: true }
  );
  console.log(`[sync] saved lastUpdateTs=${updatingDate}`);
}

if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("MongoDB connected");
      await syncFundTotals();
    } catch (err) {
      console.error(err);
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = syncFundTotals;

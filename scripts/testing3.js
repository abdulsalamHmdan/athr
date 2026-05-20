const { configDotenv } = require("dotenv");
configDotenv();
const mongoose = require("mongoose");
const AllFund = require("../models/AllFund");

async function syncFunds() {
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    console.log(`--- Page ${page} ---`);
    const res = await fetch(
      `http://donate.utq.org.sa/api/v1/goal/list?page=${page}`,
      {
        method: "get",
        headers: { k: process.env.DONATE_API_KEY },
      }
    );
    const json = await res.json();
    pageCount = json.page_count || pageCount;
    const funds = json.results.map((g) => ({
      id: g.id,
      name: g.name,
      price_goal: g.price_goal,
      stats: g.stats,
      client_id: g.client_id,
      prod_id: g.prod_id,
      type: g.type.id,
      total: g.stats.sold_total,
      done: g.stats.progress >= 100? "a" : g.stats.progress>0? "b" : "c",
    }));

    const ops = funds.map((f) => ({
      updateOne: {
        filter: { id: f.id },
        update: { $set: f },
        upsert: true,
      },
    }));

    if (ops.length) {
      const result = await AllFund.bulkWrite(ops);
      console.log("Saved funds:", {
        page,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount,
        total: funds.length,
      });
    } else {
      console.log("No funds returned from API for page", page);
    }
    page++;
  }
}

if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("MongoDB connected");
      await syncFunds();
    } catch (err) {
      console.error(err);
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = syncFunds;

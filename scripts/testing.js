const { configDotenv } = require("dotenv");
configDotenv();
const mongoose = require("mongoose");
const AllFund = require("../models/AllFund");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const res = await fetch(
      "http://donate.utq.org.sa/api/v1/goal/list?page=11",
      {
        method: "get",
        headers: { k: process.env.DONATE_API_KEY },
      }
    );
    const json = await res.json();
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
      phone:""
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
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount,
        total: funds.length,
      });
    } else {
      console.log("No funds returned from API");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();

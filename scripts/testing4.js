const { configDotenv } = require("dotenv");
configDotenv();
const mongoose = require("mongoose");
const AllFund = require("../models/AllFund");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    for (let page = 0; page <= 5; page++) {
      console.log(`--- Page ${page} ---`);
      const res = await fetch(
        `https://donate.utq.org.sa/api/v1/orders/report/goals?page=${page}&ts=1777755600-${Math.ceil(Date.now() / 1000)}`,
        {
          method: "get",
          headers: { k: process.env.DONATE_API_KEY },
        }
      );
      const json = await res.json();

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
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();

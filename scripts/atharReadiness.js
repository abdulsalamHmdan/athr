require("dotenv").config();
const mongoose = require("mongoose");
const { M, settings } = require("../services/atharCore");
const Prize = require("../models/Prize");
(async () => {
  if (!process.env.MONGO_URI) throw Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const c = await settings();
  const checks = {
    transactions: !!hello.setName || hello.msg === "isdbgrid",
    privacy: !!c.privacyURL?.startsWith("https://"),
    terms: !!c.termsURL?.startsWith("https://"),
    products:
      !c.storeEnabled ||
      (await Prize.countDocuments({ active: true, stock: { $gt: 0 } })) > 0,
    approvedCompetition:
      !c.competitionsEnabled ||
      (await M.Competition.countDocuments({
        state: { $in: ["scheduled", "live", "published"] },
      })) > 0,
    appEnabled: c.enabled,
  };
  for (const [name, passed] of Object.entries(checks))
    console.log(`${passed ? "PASS" : "PENDING"} ${name}`);
  if (process.argv.includes("--prepare-indexes")) {
    // createIndexes preserves existing indexes and data (unlike syncIndexes).
    for (const model of Object.values(mongoose.models))
      await model.createIndexes();
    console.log("PASS indexes created/verified");
  }
  if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
})()
  .catch((e) => {
    console.error("Readiness failed:", e.name);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

// Disposable preview using an isolated MongoDB replica set. No production data or secrets.
if (process.env.NODE_ENV === "production")
  throw new Error("Preview is disabled in production");
const express = require("express"),
  session = require("express-session"),
  mongoose = require("mongoose"),
  crypto = require("crypto");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
(async () => {
  const repl = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(repl.getUri());
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: crypto.randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.set("view engine", "ejs");
  app.set("views", require("path").join(__dirname, "../views"));
  app.use(express.static(require("path").join(__dirname, "../public")));
  app.use((req, res, next) => {
    req.session.adminId = "000000000000000000000001";
    next();
  });
  app.use("/admin/athar", require("../routes/atharAdmin"));
  app.use("/v1", require("../routes/atharMobile").router);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const { M } = require("../services/atharCore");
  await M.Settings.create({
    enabled: false,
    privacyURL: "https://example.org/privacy",
    termsURL: "https://example.org/terms",
  });
  await require("../models/Prize").create({
    key: "preview-cup",
    name: "كوب أثر الحراري",
    description: "منتج تجريبي لمعاينة الإدارة",
    stock: 20,
    tier: "bronze",
    pointCost: 1000,
  });
  const server = app.listen(4317, "127.0.0.1", () =>
    console.log("Athar isolated preview: http://127.0.0.1:4317/admin/athar"),
  );
  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    await repl.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

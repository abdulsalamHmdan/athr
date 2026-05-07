require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const cron = require("node-cron");
const bcrypt = require("bcryptjs");

const Ambassador = require("./models/Ambassador");
const Admin = require("./models/Admin");
const { syncStale } = require("./services/platformSync");

const authRoutes = require("./routes/auth");
const ambassadorRoutes = require("./routes/ambassador");
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");
const pagesRoutes = require("./routes/pages");
const pushRoutes = require("./routes/push");

const app = express();
app.set("trust proxy", 1);

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
  })
  .catch((err) => console.error("Mongo error:", err));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  }),
);

app.use("/auth", authRoutes);
app.use("/ambassador", ambassadorRoutes);
app.use("/admin", adminRoutes);
app.use("/api", apiRoutes);
app.use("/", pushRoutes);
app.use("/", pagesRoutes);

cron.schedule("0 * * * *", async () => {
  // console.log("[cron] hourly sync tick", new Date().toISOString());
  try {
    const result = await syncStale();
    console.log("[cron] sync done:", result);
  } catch (e) {
    console.error("[cron] sync error:", e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);

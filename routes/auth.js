const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Ambassador = require("../models/Ambassador");
const Admin = require("../models/Admin");
const { syncAmbassador } = require("../services/platformSync");
const { sendWhatsapp, trySendWhatsapp } = require("../services/whatsapp");
const { configDotenv } = require("dotenv");
configDotenv();

const router = express.Router();

const PHONE_RE = /^5[0-9]{8}$/;
const OTP_RE = /^[0-9]{6}$/;
const OTP_TTL_MS = 10 * 60 * 1000;

function isValidPhone(phone) {
  return typeof phone === "string" && PHONE_RE.test(phone);
}

function generateNumericCode(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function finalizeSignup(req, pending, isVerified) {
  const amb = await Ambassador.create({
    name: pending.name,
    phone: pending.phone,
    password: pending.passwordHash,
    isMember: !!pending.isMember,
    platformProfileId: pending.platformProfileId,
    entity: pending.isMember ? pending.entity || "" : "",
    referralCode: pending.referralCode,
    isVerified: !!isVerified,
    verifiedAt: isVerified ? new Date() : null,
  });

  req.session.ambassadorId = amb._id;
  req.session.ambassadorName = amb.name || "السفير";

  const link = `${req.protocol}://${req.get("host")}/r/${pending.referralCode}`;
  return { amb, link };
}

router.post("/signup", async (req, res) => {
  try {
    const { name, phone, password, isMember, entity } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ error: "الرجاء تعبئة جميع الحقول" });
    if (!isValidPhone(phone))
      return res
        .status(400)
        .json({
          error: "رقم الجوال يجب أن يكون 9 أرقام بدون صفر أو رمز الدولة",
        });

    const exists = await Ambassador.findOne({ phone });
    if (exists)
      return res.status(400).json({ error: "رقم الجوال مسجل مسبقاً" });

    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = crypto.randomBytes(4).toString("hex");

    let fetchData;
    try {
      const fetchResult = await fetch(
        `http://donate.utq.org.sa/api/v1/clients/new?phone=${"966" + phone}&name=${encodeURIComponent(name)}`,
        { method: "get", headers: { k: process.env.Donate_token || "" } },
      );
      fetchData = await fetchResult.json();
    } catch (e) {
      console.error("[signup] platform fetch failed:", e.message);
      return res
        .status(503)
        .json({ error: "تعذر الاتصال بمنصة التبرع، حاول لاحقاً" });
    }
    // console.log('[signup] platform response:', JSON.stringify(fetchData));
    const platformId =
      fetchData?.id ||
      fetchData?.clientId ||
      fetchData?.client_id ||
      fetchData?.data?.id ||
      fetchData?.client?.id ||
      fetchData?.result?.id;
    if (!platformId) {
      const msg = typeof fetchData?.msg === "string" ? fetchData.msg : "";
      const looksLikeSuccess = /نجاح|بنجاح|success/i.test(msg);
      if (!looksLikeSuccess) {
        return res.status(500).json({ error: msg || "خطأ في الخادم" });
      }
      console.warn(
        "[signup] platform returned success without id, continuing without platformProfileId",
      );
    }

    const pending = {
      name,
      phone,
      passwordHash,
      isMember: !!isMember,
      entity: isMember ? entity || "" : "",
      platformProfileId: platformId || null,
      referralCode,
    };

    const otp = generateNumericCode(6);
    let whatsappOk = false;
    try {
      await sendWhatsapp(
        phone,
        `مرحباً ${name} 👋\nرمز التحقق لإكمال تسجيلك كسفير:\n*${otp}*\nصالح لمدة 10 دقائق.`,
      );
      whatsappOk = true;
    } catch (e) {
      console.error("[signup] whatsapp send failed:", e.message);
    }

    if (whatsappOk) {
      const otpHash = await bcrypt.hash(otp, 10);
      req.session.pendingSignup = {
        ...pending,
        otpHash,
        otpExpires: Date.now() + OTP_TTL_MS,
      };
      return res.json({ ok: true, requiresOtp: true, phone });
    }

    const { link } = await finalizeSignup(req, pending, false);
    return res.json({
      ok: true,
      requiresOtp: false,
      verified: false,
      referralLink: link,
      referralCode: pending.referralCode,
      notice: "تم إنشاء حسابك دون تحقق واتساب، حسابك مفعّل لكن غير متحقق منه.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/signup/verify-otp", async (req, res) => {
  try {
    const pending = req.session.pendingSignup;
    if (!pending)
      return res.status(400).json({ error: "لا توجد عملية تسجيل قيد التحقق" });
    if (!pending.otpExpires || pending.otpExpires < Date.now()) {
      delete req.session.pendingSignup;
      return res
        .status(400)
        .json({ error: "انتهت صلاحية رمز التحقق، أعد التسجيل" });
    }

    const { otp } = req.body;
    if (!otp || !OTP_RE.test(String(otp)))
      return res.status(400).json({ error: "رمز التحقق يجب أن يكون 6 أرقام" });

    const ok = await bcrypt.compare(String(otp), pending.otpHash);
    if (!ok) return res.status(400).json({ error: "رمز التحقق غير صحيح" });

    const exists = await Ambassador.findOne({ phone: pending.phone });
    if (exists) {
      delete req.session.pendingSignup;
      return res.status(400).json({ error: "رقم الجوال مسجل مسبقاً" });
    }

    const { link } = await finalizeSignup(req, pending, true);
    delete req.session.pendingSignup;

    await trySendWhatsapp(
      pending.phone,
      `مرحباً ${pending.name} 🎉\nتم إنشاء حسابك كسفير في منصة "نقاط الأثر" بنجاح.\n\nهذا هو رابط الدخول السريع الخاص بك، لا تشاركه مع أحد:\n${link}`,
      "signup/verify-otp",
    );

    return res.json({
      ok: true,
      verified: true,
      referralLink: link,
      referralCode: pending.referralCode,
    });
  } catch (err) {
    console.error("[signup/verify-otp] error:", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/signup/resend-otp", async (req, res) => {
  try {
    const pending = req.session.pendingSignup;
    if (!pending)
      return res.status(400).json({ error: "لا توجد عملية تسجيل قيد التحقق" });

    const otp = generateNumericCode(6);
    try {
      await sendWhatsapp(
        pending.phone,
        `مرحباً ${pending.name} 👋\nرمز التحقق لإكمال تسجيلك كسفير:\n*${otp}*\nصالح لمدة 10 دقائق.`,
      );
    } catch (e) {
      console.error("[signup/resend-otp] whatsapp send failed:", e.message);
      const { link } = await finalizeSignup(req, pending, false);
      delete req.session.pendingSignup;
      return res.json({
        ok: true,
        fallback: true,
        verified: false,
        referralLink: link,
        referralCode: pending.referralCode,
        notice: "خدمة واتساب غير متاحة، تم إنشاء الحساب بدون تحقق.",
      });
    }

    const otpHash = await bcrypt.hash(otp, 10);
    req.session.pendingSignup = {
      ...pending,
      otpHash,
      otpExpires: Date.now() + OTP_TTL_MS,
    };
    res.json({ ok: true });
  } catch (err) {
    console.error("[signup/resend-otp] error:", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!isValidPhone(phone))
      return res
        .status(400)
        .json({
          error: "رقم الجوال يجب أن يكون 9 أرقام بدون صفر أو رمز الدولة",
        });
    const amb = await Ambassador.findOne({ phone });
    if (!amb) return res.status(400).json({ error: "بيانات غير صحيحة" });
    const ok = await bcrypt.compare(password, amb.password);
    if (!ok) return res.status(400).json({ error: "بيانات غير صحيحة" });
    req.session.ambassadorId = amb._id;
    req.session.ambassadorName = amb.name || "السفير";
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const admin = await Admin.findOne({ phone });
    if (!admin) return res.status(400).json({ error: "بيانات غير صحيحة" });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(400).json({ error: "بيانات غير صحيحة" });
    req.session.adminId = admin._id;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!isValidPhone(phone))
      return res
        .status(400)
        .json({
          error: "رقم الجوال يجب أن يكون 9 أرقام بدون صفر أو رمز الدولة",
        });

    const amb = await Ambassador.findOne({ phone });
    if (!amb) return res.status(404).json({ error: "الرقم غير مسجل كسفير" });

    const otp = generateNumericCode(6);
    const otpHash = await bcrypt.hash(otp, 10);
    await Ambassador.updateOne(
      { _id: amb._id },
      {
        $set: {
          resetOtp: otpHash,
          resetOtpExpires: new Date(Date.now() + OTP_TTL_MS),
        },
      },
    );

    try {
      await sendWhatsapp(
        phone,
        `مرحباً ${amb.name} 👋\nرمز التحقق لاستعادة الوصول إلى حسابك:\n*${otp}*\nصالح لمدة 10 دقائق.`,
      );
    } catch (e) {
      console.error("[forgot-password] whatsapp send failed:", e.message);
      return res
        .status(502)
        .json({
          error:
            e.userMessage || "تعذّر إرسال رمز التحقق عبر واتساب، حاول لاحقاً",
        });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password] error:", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!isValidPhone(phone))
      return res.status(400).json({ error: "رقم الجوال غير صحيح" });
    if (!otp || !OTP_RE.test(String(otp)))
      return res.status(400).json({ error: "رمز التحقق يجب أن يكون 6 أرقام" });

    const amb = await Ambassador.findOne({ phone });
    if (!amb || !amb.resetOtp || !amb.resetOtpExpires) {
      return res
        .status(400)
        .json({ error: "لم يتم طلب إعادة تعيين كلمة المرور" });
    }
    if (amb.resetOtpExpires.getTime() < Date.now()) {
      await Ambassador.updateOne(
        { _id: amb._id },
        { $set: { resetOtp: null, resetOtpExpires: null } },
      );
      return res.status(400).json({ error: "انتهت صلاحية رمز التحقق" });
    }

    const ok = await bcrypt.compare(String(otp), amb.resetOtp);
    if (!ok) return res.status(400).json({ error: "رمز التحقق غير صحيح" });

    await Ambassador.updateOne(
      { _id: amb._id },
      { $set: { resetOtp: null, resetOtpExpires: null } },
    );

    const baseUrl =
      process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    const loginLink = `${baseUrl}/r/${amb.referralCode}`;

    try {
      await sendWhatsapp(
        phone,
        `مرحباً ${amb.name} 👋\nهذا رابط الدخول السريع الخاص بك:\n${loginLink}\n\nلا تشاركه مع أحد.`,
      );
    } catch (e) {
      console.error("[verify-otp] whatsapp send failed:", e.message);
      return res
        .status(502)
        .json({
          error:
            e.userMessage || "تعذّر إرسال الرابط عبر واتساب، تواصل مع الإدارة",
        });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[verify-otp] error:", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;

// server.js
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const helmet = require("helmet");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const app = express();

/*
 Basic environment checks. Not fatal, but helpful during development.
*/
const requiredEnvs = [
  "MONGO_URI",
  "SESSION_SECRET",
  "PAYSTACK_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
];

requiredEnvs.forEach((name) => {
  if (!process.env[name]) {
    console.warn(`⚠️  Environment variable ${name} is not set.`);
  }
});

// If your app is behind a proxy like Render, Fly, or Heroku enable trust proxy.
// Toggle by setting TRUST_PROXY=true in env.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
  console.info("ℹ️  trust proxy enabled");
}

// ====================
// MIDDLEWARE
// ====================
app.use(cors());
app.use(helmet());

// Body parser with raw body capture for webhook signature verification
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      // store raw buffer required for signature verification
      req.rawBody = buf;
    },
  })
);
app.use(bodyParser.urlencoded({ extended: true }));

// ====================
// ====================
// DATABASE + SESSIONS (updated)
// ====================
async function startApp() {
  try {
    // connect to MongoDB. no useNewUrlParser or useUnifiedTopology needed with driver >=4
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/donations", {
      // optional: set a reasonable server selection timeout if you want
      // serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");

    // Reuse mongoose's underlying MongoClient for session store
    const mongoClient = mongoose.connection.getClient();

    app.use(
      session({
        secret: process.env.SESSION_SECRET || "change_this_in_prod",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
          maxAge: 1000 * 60 * 60,
        },
        store: MongoStore.create({
          client: mongoClient,
          collectionName: "sessions",
        }),
      })
    );

    // start server only after DB and session store set up
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // fail fast so the platform can restart or alert you
  }
}

// call the async starter
startApp();


// Donation model
const donationSchema = new mongoose.Schema({
  email: { type: String, required: true },
  amount: { type: Number, required: true }, // store in smallest currency unit, e.g. Kobo or cents
  createdAt: { type: Date, default: Date.now },
});

const Donation = mongoose.model("Donation", donationSchema);

// ====================
// SESSIONS
// ====================
// Use secure cookies only in production, allow local testing in development
const sessionCookieSecure = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_this_in_prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: sessionCookieSecure, // true requires HTTPS
      httpOnly: true,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60, // 1 hour
    },
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || "mongodb://localhost:27017/donations",
      collectionName: "sessions",
    }),
  })
);

// Simple auth middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }
  next();
}

// ====================
// RATE LIMITERS
// ====================
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { status: "error", message: "Too many requests. Please try again later." },
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts
  message: { status: "error", message: "Too many login attempts. Try again later." },
});

// ====================
// ROUTES
// ====================

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Get donation progress
app.get("/get-progress", async (req, res) => {
  try {
    const donations = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const raised = donations.length > 0 ? donations[0].total : 0;
    res.json({ status: "success", raised });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Get donors
app.get("/get-donors", async (req, res) => {
  try {
    const donors = await Donation.find().sort({ createdAt: -1 }).limit(20);
    res.json({ status: "success", donors });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Verify payment with Paystack
app.post("/verify-payment", verifyLimiter, async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ status: "error", message: "Missing reference" });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
      }
    );

    const data = response.data;

    // Example success shape: { status: true, message: "...", data: { status: "success", amount: 20000, customer: { email: "..." } } }
    if (data && data.status && data.data && data.data.status === "success") {
      const verifiedAmount = data.data.amount;
      const customerEmail = data.data.customer && data.data.customer.email ? data.data.customer.email : "unknown";

      const donation = new Donation({
        email: customerEmail,
        amount: verifiedAmount,
      });
      await donation.save();

      return res.json({ status: "success" });
    } else {
      // return full data for easier debugging by client if needed
      return res.status(400).json({ status: "failed", message: "Payment not successful", details: data });
    }
  } catch (err) {
    console.error("Verify error:", err.response ? err.response.data : err.message);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// Paystack webhook
app.post("/paystack-webhook", async (req, res) => {
  try {
    // Ensure rawBody is present. If not, signature check cannot be performed.
    if (!req.rawBody) {
      console.warn("Webhook received without rawBody, signature cannot be verified.");
      return res.status(400).send("Bad request");
    }

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET)
      .update(req.rawBody)
      .digest("hex");

    const incoming = req.headers["x-paystack-signature"];

    if (hash !== incoming) {
      console.warn("Webhook signature mismatch. computed:", hash, "incoming:", incoming);
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;

    if (event && event.event === "charge.success") {
      const { customer, amount } = event.data || {};
      try {
        const email = (customer && customer.email) || (customer && customer.email) || "unknown";
        const donation = new Donation({ email, amount });
        await donation.save();

        console.log("✅ Webhook saved donation:", email, "Amount:", amount);
      } catch (err) {
        console.error("Webhook save error:", err.message);
      }
    } else {
      // For other events, you may want to log or handle differently
      console.log("Webhook event received:", event && event.event);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook handling error:", err.message);
    res.sendStatus(500);
  }
});

// ====================
// ADMIN ROUTES
// ====================

// Admin login
app.post("/admin/login", adminLoginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Missing credentials" });
  }

  try {
    if (email === process.env.ADMIN_EMAIL) {
      const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || "");
      if (match) {
        req.session.user = { email };
        return res.json({ status: "success", message: "Logged in" });
      }
    }
    return res.status(401).json({ status: "error", message: "Invalid credentials" });
  } catch (err) {
    console.error("Admin login error:", err.message);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// Admin logout
app.post("/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err);
      return res.status(500).json({ status: "error", message: "Logout failed" });
    }
    // Clear cookie name used by express-session. If you customized name, clear that instead.
    res.clearCookie("connect.sid");
    res.json({ status: "success", message: "Logged out" });
  });
});

// View all donors
app.get("/admin/donors", requireAuth, async (req, res) => {
  try {
    const donors = await Donation.find().sort({ createdAt: -1 });
    res.json({ status: "success", donors });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Export donors as CSV
app.get("/admin/export", requireAuth, async (req, res) => {
  try {
    const donors = await Donation.find().sort({ createdAt: -1 });

    let csv = "email,amount,createdAt\n";
    donors.forEach((d) => {
      csv += `${d.email},${d.amount},${d.createdAt.toISOString()}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("donors.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Generic 404
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack || err);
  res.status(500).json({ status: "error", message: "Internal server error" });
});

// ====================
// START SERVER
// ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

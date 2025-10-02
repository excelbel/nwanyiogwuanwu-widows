// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");

require("dotenv").config();

const app = express();
app.use(cors());

// capture raw body for signature validation
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

// ====================
// Fake in-memory database, amounts in naira
let donors = [
  { email: "john@example.com", amount: 50.0 }, // ₦50.00
  { email: "mary@example.com", amount: 100.0 } // ₦100.00
];
let raised = donors.reduce((sum, d) => sum + d.amount, 0);

// helper to normalize to 2 decimal places
function toNaira(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return NaN;
  return Number(n.toFixed(2));
}

// simple helper to ensure PAYSTACK_SECRET exists
function requirePaystackSecret(res) {
  const secret = process.env.PAYSTACK_SECRET;
  if (!secret) {
    console.error("PAYSTACK_SECRET is not set in environment variables.");
    if (res) res.status(500).json({ status: "error", message: "Server misconfigured: missing PAYSTACK_SECRET" });
    return null;
  }
  return secret;
}

// ====================
// GET donation progress
app.get("/get-progress", (req, res) => {
  try {
    res.json({ status: "success", raised });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ====================
// GET donors
app.get("/get-donors", (req, res) => {
  try {
    res.json({ status: "success", donors });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ====================
// VERIFY payment (manual check with Paystack API)
// Expectation: client sends { reference: '...', amount: 50.00 } in naira
app.post("/verify-payment", async (req, res) => {
  try {
    const { reference, amount } = req.body;

    if (!reference || amount === undefined || amount === null) {
      return res.status(400).json({ status: "error", message: "Missing reference or amount" });
    }

    const providedAmount = toNaira(amount);
    if (Number.isNaN(providedAmount)) {
      return res.status(400).json({ status: "error", message: "Invalid amount format" });
    }

    const secret = requirePaystackSecret(res);
    if (!secret) return; // response already sent

    const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${secret}`
      }
    });

    const data = response.data;
    // Paystack returns data.status (boolean) and data.data.status (string like 'success')
    if (!data || !data.status || !data.data || data.data.status !== "success") {
      return res.status(400).json({ status: "failed", message: "Paystack returned unsuccessful transaction or unexpected response" });
    }

    // Paystack amount is in kobo, convert to naira
    const paystackAmountKobo = Number(data.data.amount);
    const paystackAmountNaira = toNaira(paystackAmountKobo / 100);

    if (Number.isNaN(paystackAmountNaira)) {
      return res.status(400).json({ status: "error", message: "Invalid amount from Paystack" });
    }

    if (paystackAmountNaira === providedAmount) {
      const customerEmail = data.data.customer && data.data.customer.email ? data.data.customer.email : "unknown@noemail";

      // Add donor and update progress, all in naira
      raised = toNaira(raised + providedAmount);
      donors.unshift({
        email: customerEmail,
        amount: providedAmount
      });

      return res.json({ status: "success" });
    } else {
      console.warn("Verification failed, amount mismatch", { reference, paystackAmountNaira, providedAmount });
      return res.json({ status: "failed", message: "Verification failed, amount mismatch" });
    }
  } catch (err) {
    console.error("verify-payment error", err && err.message ? err.message : err);
    return res.status(500).json({ status: "error", message: err.message || "Server error" });
  }
});

// ====================
// PAYSTACK WEBHOOK
// We convert the incoming kobo amount to naira before storing
app.post("/paystack-webhook", (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!signature) {
      return res.status(400).send("Missing signature header");
    }

    const secret = process.env.PAYSTACK_SECRET || "";
    if (!secret) {
      console.error("PAYSTACK_SECRET not set, rejecting webhook");
      return res.status(500).send("Server misconfigured");
    }

    const hash = crypto.createHmac("sha512", secret).update(req.rawBody).digest("hex");

    // use timingSafeEqual for safer comparison
    const hashBuf = Buffer.from(hash, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (hashBuf.length !== sigBuf.length || !crypto.timingSafeEqual(hashBuf, sigBuf)) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body;

    if (event && event.event === "charge.success" && event.data) {
      const { customer, amount } = event.data;
      const customerEmail = customer && customer.email ? customer.email : "unknown@noemail";

      // amount from Paystack is in kobo, convert to naira
      const amtNaira = toNaira(Number(amount) / 100);
      if (!Number.isNaN(amtNaira)) {
        raised = toNaira(raised + amtNaira);
        donors.unshift({
          email: customerEmail,
          amount: amtNaira
        });
        console.log("✅ Webhook: Payment successful for", customerEmail, "Amount (naira):", amtNaira);
      } else {
        console.warn("Webhook: invalid amount", amount);
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("paystack-webhook error", err);
    return res.status(500).send("Server error");
  }
});

app.get("/", (req, res) => {
  res.send("🚀 Your Paystack donation API is live!");
});

// ====================
// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

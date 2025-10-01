// ====================
// EXPRESS SERVER (Node.js replacement for PHP files)
// ====================
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");

require("dotenv").config(); // For PAYSTACK_SECRET in .env

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ====================
// Fake in-memory database
// Replace with real DB if needed
// ====================
let donors = [
  { email: "john@example.com", amount: 5000 },  // ₦50
  { email: "mary@example.com", amount: 10000 }  // ₦100
];
let raised = donors.reduce((sum, d) => sum + d.amount, 0);

// ====================
// GET donation progress
// ====================
app.get("/get-progress", (req, res) => {
  try {
    res.json({ status: "success", raised });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ====================
// GET donors
// ====================
app.get("/get-donors", (req, res) => {
  try {
    res.json({ status: "success", donors });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ====================
// VERIFY payment (Paystack)
// ====================
app.post("/verify-payment", async (req, res) => {
  const { reference, amount } = req.body;

  if (!reference || !amount) {
    return res.status(400).json({ status: "error", message: "Missing reference or amount" });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` }
      }
    );

    const data = response.data;

    if (data.status && data.data.amount === amount) {
      // Add donor and update progress
      raised += amount;
      donors.unshift({
        email: data.data.customer.email,
        amount: amount
      });

      return res.json({ status: "success" });
    } else {
      return res.json({ status: "failed", message: "Verification failed" });
    }
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// ====================
// START SERVER
// ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

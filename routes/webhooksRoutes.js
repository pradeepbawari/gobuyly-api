const express = require("express");
const { webhookcashfree } = require("../controllers/webhookController");

const router = express.Router();

// ✅ Only this route uses raw body for signature verification
router.post(
  "/cashfree",
  express.raw({ type: "application/json" }),
  webhookcashfree
);

module.exports = router;

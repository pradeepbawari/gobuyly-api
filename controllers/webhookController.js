// controllers/webhookController.js
const db = require("../models");
const crypto = require("crypto");

const webhookcashfree = async (req, res) => {
  try {
    console.log("👉 Cashfree webhook hit");

    // Raw body (Buffer)
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const secret = process.env.CASHFREE_SECRET_KEY; // Your original API Secret

    const rawBody = req.body; // Buffer from express.raw
    const bodyString = rawBody.toString("utf8");

    // Combine timestamp + payload for signature
    const dataToSign = timestamp + bodyString;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(dataToSign)
      .digest("base64");

    console.log("Received Signature:", signature);
    console.log("Expected Signature:", expected);


    if (signature !== expected) {
      console.error("❌ Invalid signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Parse payload AFTER verification
    const payload = JSON.parse(rawBody.toString("utf8"));
    console.log("✅ Verified payload:", JSON.stringify(payload, null, 2));

    // Extract data
    const { order, payment } = payload?.data || {};
    const orderId = order?.order_id;
    const paymentStatus = payment?.payment_status; // may not be present
    const eventType = payload?.type;

    if (!orderId || !eventType) {
      return res.status(400).json({ error: "Missing orderId or event type" });
    }

    // Map Cashfree event type to your DB status
    let newStatus;
    switch (eventType) {
      case "PAYMENT_SUCCESS_WEBHOOK":
        newStatus = "PAID";
        break;
      case "PAYMENT_FAILED_WEBHOOK":
        newStatus = "FAILED";
        break;
      case "REFUND_SUCCESS_WEBHOOK":
        newStatus = "REFUNDED";
        break;
      default:
        console.warn(`⚠️ Unhandled event type: ${eventType}`);
        return res.status(200).json({ ignored: true });
    }

    // Update DB
    await db.Orderwebsite.update(
      { payment_status: newStatus },
      { where: { order_id: orderId } }
    );

    console.log(`✅ Order ${orderId} updated to status ${newStatus}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Cashfree Webhook Error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

module.exports = { webhookcashfree };

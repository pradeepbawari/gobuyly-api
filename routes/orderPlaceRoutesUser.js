const express = require('express');
const { createOrder, getOrders, calculateShipping, checkPincode, checkzone, shippingcharge, verifyReferralCodeuserId, referalProducts, cashfreeOrder, verifyOrder, webhookcashfree } = require('../controllers/orderPlaceController');
const router = express.Router();

// POST endpoint to create an order
router.post('/casefree', cashfreeOrder);
router.post('/verifyOrder', verifyOrder);
router.post('/webhooks/cashfree', webhookcashfree);
router.post('/new', createOrder);
router.post('/all', getOrders);
router.post('/calculateShipping', calculateShipping);
router.post('/checkpincode', checkPincode);
router.post('/checkzone', checkzone);
router.post('/shippingcharge', shippingcharge);
router.post("/verifyReffUser", verifyReferralCodeuserId);
router.post("/referalProducts", referalProducts);
 
module.exports = router;

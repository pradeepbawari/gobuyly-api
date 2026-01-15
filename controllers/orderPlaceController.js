const { where, Op } = require('sequelize');
const db = require('../models');
const { Order, OrderItem, Product } = require("../models");
const product = require('../models/product');
const weight = require('../models/weight');
const nodemailer = require("nodemailer");

const createOrder = async (req, res) => {
  try {
    const {
      userId,
      address,
      amount,
      cartItems,
      paymentDetails='',
      status = 'PENDING',
      referral='',
      shipping,
      customerName,
      customerEmail,
      customerPhone,
	  payment_status = 'PENDING',
    } = req.body.orderDetails;

    // ✅ Validate required fields
    if (!userId || !address || !amount || !cartItems) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderId = "order_" + Date.now();
	//console.log('ddd', `${process.env.API_URL}/webhooks/cashfree`)

    // ✅ Create order in DB
    const order = await db.Orderwebsite.create({
      order_id: orderId,
      user_id: userId,
      address,
      amount,
      paymentDetails,
      status,
      referral,
      payment_status,
      shipping
    });

    // ✅ Insert order items
    if (cartItems && Array.isArray(cartItems)) {
      await db.OrderWebsiteItems.bulkCreate(
        cartItems.map(item => ({
          order_id: order.id,
          variant_id: item.productId || null,
          quantity: item.quantity,
          price: item?.price,
          status,
          sku: item?.sku,
          gst: item?.gst
        }))
      );
    }
	
//console.log("CASHFREE_ENV =>", JSON.stringify(process.env.CASHFREE_ENV));
//console.log(process.env.CASHFREE_ENV === "PROD" );

    // ✅ Cashfree order create
    //const CF_BASE =
  // process.env.CASHFREE_ENV === "PROD"
  //   ? "https://api.cashfree.com/pg/orders"
  //   : "https://sandbox.cashfree.com/pg/orders";


    // const response = await fetch(CF_BASE, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "x-client-id": process.env.CASHFREE_APP_ID,
    //     "x-client-secret": process.env.CASHFREE_SECRET_KEY,
    //     "x-api-version": "2022-09-01",
    //   },
    //   body: JSON.stringify({
    //     order_id: orderId,
    //     order_amount: amount,
    //     order_currency: "INR",
    //     customer_details: {
    //       customer_id: String(userId),
    //       customer_name: customerName,
    //       customer_email: customerEmail,
    //       customer_phone: customerPhone,
    //     },
    //     order_meta: { 
		// 	notify_url: `${process.env.API_URL}/api/webhooks/cashfree`,
		// 	return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order-success?order_id=${orderId}&cf_id={order_id}`
		// }, 
		// }), 
		// });

    // const data = await response.json();

    // if (!data?.payment_session_id) {
    //   return res.status(400).json({
    //     error: "Failed to create Cashfree order",
    //     details: data,
    //   });
    // }

    // ✅ Send response to frontend
    res.status(200).json({
      order,
      order_id: orderId,
      // payment_session_id: data.payment_session_id,
    });

  } catch (err) {
    console.error("Create Order Error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

const webhookcashfree = async (req, res) => {
  try {
    const data = req.body;
	console.log(data)

    // Verify signature (important!)
    const signature = req.headers["x-webhook-signature"];
    const expected = crypto
      .createHmac("sha256", process.env.CASHFREE_WEBHOOK_SECRET)
      .update(JSON.stringify(data))
      .digest("base64");

    if (signature !== expected) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { order_id, order_status } = data;

    // Update your DB order
    await db.Orderwebsite.update({
      where: { orderId: order_id },
      data: { payment_status: order_status },
    });
console.log(res, 'fasfafdasd')
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cashfree Webhook Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};



const cashfreeOrder = async (req, res) => {
  try {
    const orderDetails = req.body.orderDetails;
    const { amount, customerName, customerEmail, customerPhone } = orderDetails;

    const CF_BASE =
      process.env.CASHFREE_ENV === "PROD"
        ? "https://api.cashfree.com/pg/orders"
        : "https://sandbox.cashfree.com/pg/orders";

    const order_id = "order_" + Date.now();

    const response = await fetch(CF_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY,
        "x-api-version": "2022-09-01",
      },
      body: JSON.stringify({
        order_id,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: "cust_" + Date.now(),
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
        },
        order_meta: {
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order-success?order_id={order_id}`,
        },
        order_note: "Himdali order",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data });
    }

    return res.json({
      order_id,
      payment_session_id: data.payment_session_id,
    });
  } catch (e) {
    console.error("CF create-order error:", e);
    return res.status(500).json({ error: "Order creation failed" });
  }
};

const verifyOrder = async (req, res) => {
  const { order_id } = req.query;
  try {
  const response = await fetch(
    `https://sandbox.cashfree.com/pg/orders/${order_id}`,
    {
      headers: {
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY,
        "x-api-version": "2022-09-01",
      },
    }
  );

  const data = await response.json();
  
  //await createOrderAfterCashfree();

  // Save to DB
  //await db.payment.create({
    //data: {
      //order_id: data.order_id,
      //status: data.order_status,
      //amount: data.order_amount,
      //payment_method: data.payment_method?.[0]?.payment_mode,
    //},
  //});
 //console.log(data)
  res.json({ status: data.order_status });
} catch(error){
	res.json({ status: 'error' });
}
}


const createOrderAfterCashfree = async (data) => {
  try {
    const {
      userId,
      address,
      amount,
      cartItems,
      paymentDetails,
      status = 'PENDING',
      referral,
	  payment_status
    } = req.body.orderDetails;
    // console.log(user_id, address, amount, cartItems, paymentDetails)

    // ✅ Validate required fields
    if (!userId || !address || !amount || !cartItems || !paymentDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user_id = userId;
    // ✅ Create order
    const order = await db.Orderwebsite.create({
      user_id,
      address, // Sequelize supports JSON, no need to stringify
      amount,
      paymentDetails,
      status,
      referral,
      payment_status // Optional: Set based on Razorpay success
    });

    // ✅ Create order items (if you have them separately)
    if (cartItems && Array.isArray(cartItems)) {
      await db.OrderWebsiteItems.bulkCreate(
        cartItems.map(item => ({
          order_id: order.id,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          price: item?.variant.price,
          gst: 0,
          total: 0,
          slug: item?.slug,
          status,
          images: item?.image,
          title: item?.name,
          sku: item?.sku,
          dimType: item?.variant?.parsedDimensions?.typeName,
          dimValue: item?.variant?.parsedDimensions?.unit,
          dimunitName: item?.variant?.parsedDimensions?.unitName
        }))
      );
    }

    // ✅ Optional email sending (if needed)
    // await sendEmail({ userData: { user_id }, items: cartItems });

    res.status(201).json({
      message: 'Order created successfully!',
      order_id: order.id
    });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// const getOrders = async (req, res) => {
//   const { userid } = req.body;
//   if(!userid){
//     return res.status(400).json({ error: 'Missing required fields' });
//   }
//   try {
//     const orders = await db.Orderwebsite.findAll({
//       where: { user_id: userid },
//       include: [
//         {
//           model: db.OrderWebsiteItems, // Corrected name (remove 's')
//           as: 'orderItems',
//           attributes: ["id", "order_id", "product_id", "variant_id", "quantity", "price", "gst", "total"],
//         },
//       ],
//       attributes: ["id", "user_id", "address", "amount", "paymentDetails", "status"],
//     });    
//     res.status(200).json(orders);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: error.message });
//   }
// };

const getOrders = async (req, res) => {
  const { userid } = req.body;
  if (!userid) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const orders = await db.Orderwebsite.findAll({
      where: { user_id: userid },
      include: [
        {
          model: db.OrderWebsiteItems,
          as: 'orderItems',
          attributes: [
            "id", "order_id", "variant_id",
            "quantity", "price", "status", "sku"
          ],
        },
      ],
      attributes: [
        "id", "user_id", "address", "amount", "paymentDetails", "status", "payment_status", "shipping"
      ],
      order: [['id', 'DESC']], // Optional: sort latest first
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Assuming Express.js route

const checkPincode = async (req, res) => {
  const { pincode } = req.body;
  const pincodeData = await db.ShippingZone.findOne({
    where: {
      pincode_start: { [Op.lte]: pincode },
      pincode_end: { [Op.gte]: pincode },
    },
  });

  if (!pincodeData) {
    return res.status(200).json({ success: 'Delivery pincode not serviceable' });
  } else {
    return res.status(200).json({ success: 'Delivery pincode is serviceable' });
  }
}

// const calculateShipping = async (req, res) => {
//   try {
//     const { cartItems, deliveryPincode, isCOD } = req.body.data;

//     if (!cartItems || !deliveryPincode) {
//       return res.status(400).json({ error: 'Missing cartItems or deliveryPincode' });
//     }

//     // Step 1: Get Zone from delivery pincode
//     const pincodeData = await db.ShippingZone.findOne({
//       //where: { pincode: deliveryPincode }
// 	  where: {
//         pincode_start: { [Op.lte]: deliveryPincode },
//         pincode_end: { [Op.gte]: deliveryPincode },
//       },
//     });

//     if (!pincodeData) {
//       return res.status(404).json({ error: 'Delivery pincode not serviceable' });
//     }

//     const zone = pincodeData.zone;

//     // Step 2: Calculate total weight and subtotal
//     let totalWeightKg = 0;
//     let subtotal = 0;

//     for (const key in cartItems) {
//       const item = cartItems[key];
//       const { quantity, price, variant } = item;

//       const dimension = variant?.parsedDimensions?.[0];

//       if (!dimension || !dimension.unitName || !dimension.value) {
//         return res.status(400).json({ error: 'Missing or invalid dimensions in cart item' });
//       }

//       let weightKg = parseFloat(dimension.value);

//       // Convert to kg if needed
//       if (dimension.unitName.toLowerCase() === 'g' || dimension.unitName.toLowerCase() === 'gram') {
//         weightKg = weightKg / 1000;
//       } else if (dimension.unitName.toLowerCase() === 'kg' || dimension.unitName.toLowerCase() === 'kilogram') {
//         // already in kg
// 		weightKg = (weightKg * 1000);
//       } else {
//         return res.status(400).json({ error: `Unsupported unit: ${dimension.unitName}` });
//       }

//       totalWeightKg += weightKg * quantity;
//       subtotal += parseFloat(price) * quantity;
//     }

//     // Step 3: Free shipping if subtotal exceeds ₹700
//     if (subtotal >= 700) {
//       return res.status(200).json({ shippingCharge: 0, courierName: 'Free Shipping' });
//     }
//     // Step 4: Get rate based on weight and zone
//     const shippingRate = await db.ShippingRate.findOne({
//       where: {
//         zone,
//         //is_cod: isCOD,
//         min_weight: { [Op.lte]: totalWeightKg },
//         max_weight: { [Op.gte]: totalWeightKg }
//       }
//     });

//     if (!shippingRate) {
//       console.error('No shipping rate found for:', { zone, totalWeightKg, isCOD });
//       return res.status(404).json({ error: 'No shipping rate found for this weight and zone' });
//     }

//     return res.status(200).json({
//       shippingCharge: parseInt(shippingRate.base_rate),
//       courierName: shippingRate.courier_name
//     });

//   } catch (error) {
//     console.error('Error in calculateShipping:', error);
//     res.status(500).json({ error: 'Internal server error while calculating shipping' });
//   }
// };

const calculateShipping = async (req, res) => {
  try {
    const { cartItems, deliveryPincode, isCOD } = req.body?.data;

    if (!cartItems || !deliveryPincode) {
      return res.status(400).json({ error: 'Missing cartItems or deliveryPincode' });
    }

    // Step 1: Calculate subtotal
    let subtotal = 0;
    for (const key in cartItems) {
      const item = cartItems[key];
      const { quantity } = item;
      let price = item.price || item.variant?.sale_price || item.variant?.price;

      if (!price || !quantity) {
        return res.status(400).json({ error: 'Missing price or quantity in cart item' });
      }

      if (!price || !quantity) {
        return res.status(400).json({ error: 'Missing price or quantity in cart item' });
      }

      subtotal += parseFloat(price) * quantity;
    }

    // Step 2: Free shipping if subtotal ≥ ₹700
    if (subtotal >= 700) {
      return res.status(200).json({ shippingCharge: 0, courierName: 'Free Shipping' });
    }

    // Step 3: Get Zone from delivery pincode
    const pincodeData = await db.ShippingZone.findOne({
      where: {
        pincode_start: { [Op.lte]: deliveryPincode },
        pincode_end: { [Op.gte]: deliveryPincode },
      },
    });

    if (!pincodeData) {
      return res.status(404).json({ error: 'Delivery pincode not serviceable' });
    }

    const zone = pincodeData.zone;

    // Step 4: Calculate total weight
    let totalWeightKg = 0;
    for (const key in cartItems) {
      const item = cartItems[key];
      const { quantity, variant } = item;
      let weightKg = 0;

      const dimension = variant?.parsedDimensions?.find(dim =>
        dim.unitName && ['g', 'gram', 'kg', 'ml', 'kilogram', 'pack'].includes(dim.unitName.toLowerCase())
      );

      if (!dimension || !dimension.unitName || !dimension.value) {
        return res.status(400).json({ error: 'Missing or invalid weight/dimensions in cart item' });
      }

      let value = parseFloat(dimension.value);
      let unit = dimension.unitName.toLowerCase();

      if (unit === 'g' || unit === 'gram') {
        weightKg = value / 1000;
      }
      else if (unit === 'kg' || unit === 'kilogram') {
        weightKg = value;
      }
      else if (unit === 'ml' || unit === 'millilitre' || unit === 'milliliter') {
        // Assuming 1 ml = 1 g for shampoo/juice
        weightKg = value / 1000;
      }
      else {
        return res.status(400).json({ error: `Unsupported unit: ${dimension.unitName}` });
      }

      totalWeightKg += weightKg * quantity;
    }
    totalWeightKg = totalWeightKg < 500 ? 500 : totalWeightKg;
    // Step 5: Get rate based on weight and zone
    const shippingRate = await db.ShippingRate.findOne({
      where: {
        zone,
        min_weight: { [Op.lte]: totalWeightKg },
        max_weight: { [Op.gte]: totalWeightKg }
      }
    });

    if (!shippingRate) {
      console.error('No shipping rate found for:', { zone, totalWeightKg, isCOD });
      return res.status(404).json({ error: 'No shipping rate found for this weight and zone' });
    }

    return res.status(200).json({
      shippingCharge: parseInt(shippingRate.base_rate),
      courierName: shippingRate.courier_name
    });

  } catch (error) {
    console.error('Error in calculateShipping:', error);
    res.status(500).json({ error: 'Internal server error while calculating shipping' });
  }
};


const checkzone = async (req, res) => {
  try {
    const zoneData = await db.ShippingZone.findAll();

    if (!zoneData) {
      return res.status(404).json({ error: 'Zone not found for this pincode' });
    }

    return res.status(200).json({ zone: { rows: zoneData, count: zoneData.length } });
  } catch (error) {
    console.error('Error checking zone:', error);
    res.status(500).json({ error: 'Internal server error while checking zone' });
  }
};

const shippingcharge = async (req, res) => {
  try {
    const shippingData = await db.ShippingRate.findAll();

    if (!shippingData) {
      return res.status(404).json({ error: 'Shipping rates not found' });
    }

    return res.status(200).json({ shipping: { rows: shippingData, count: shippingData.length } });
  } catch (error) {
    console.error('Error fetching shipping rates:', error);
    res.status(500).json({ error: 'Internal server error while fetching shipping rates' });
  }
};

const verifyReferralCodeuserId = async (req, res) => {
  const { referal, user_id } = req.body?.data;
  if (!referal && !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const referral = await db.Referral.findOne({
      where: { generate_code: referal, user_id: user_id }
    });
    res.status(200).json({ referral });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// const referalProducts = async (req, res) => {
//   const { referal, user_id } = req.body?.data;
//   if (!referal && !user_id) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   try {
//     const orderData = await db.Orderwebsite.findAll({
//       where: { referral: referal },
//       include: [
//         {
//           model: db.OrderWebsiteItems,
//           as: 'orderItems',
//           attributes: [
//             "id", "order_id", "product_id", "variant_id",
//             "quantity", "price", "gst", "total", "status", "images", "title", "slug", "sku"
//           ],
//         },
//       ],
//       attributes: [
//         "id", "status", "referral"
//       ],
//       order: [['id', 'DESC']], // Optional: sort latest first
//     });

//     res.status(200).json({ orderData: orderData });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: error.message });
//   }
// };

const referalProducts = async (req, res) => {
  const { referal, user_id } = req.body?.data;
  if (!referal && !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const orderData = await db.Orderwebsite.findAll({
      where: { referral: referal },
      include: [
        {
          model: db.OrderWebsiteItems,
          as: 'orderItemsReferral',
          attributes: [
            "id", "order_id", "product_id", "variant_id",
            "quantity", "price", "gst", "total", "status", "images", "title", "slug", "sku"
          ],
          include: [
          {
            model: db.Variant,
            as: 'variantOrder',
            attributes: ["referral_cost"]
          }
        ]
        },
      ],
      attributes: [
        "id", "status", "referral", "payment_status"
      ],
      order: [['id', 'DESC']],
    });

    res.status(200).json({ orderData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


module.exports = { createOrder, getOrders, calculateShipping, checkPincode, checkzone, shippingcharge, verifyReferralCodeuserId, referalProducts, cashfreeOrder, verifyOrder, webhookcashfree };
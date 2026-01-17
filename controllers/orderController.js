const { where } = require('sequelize');
const db = require('../models');
const { Order, OrderItem, Product } = require("../models");
const product = require('../models/product');
const weight = require('../models/weight');
const nodemailer = require("nodemailer");

const createOrder = async (req, res) => {
  const { user_id, status, payment_status, comments, items, userData } = req.body;

  try {
    // Ensure items are present and have the correct structure
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Calculate totals
    let totalAmount = 0;
    let gstAmount = 0;
    let offerTotal = 0;

    // Check if each product exists in the products table
    const productIds = items.map(item => item.product_id);
    const products = await db.Variant.findAll({
      where: {
        product_id: productIds,
      }
    });

    const productIdsInDb = products.map(product => product.product_id);
    const invalidProductIds = productIds.filter(id => !productIdsInDb.includes(id));

    if (invalidProductIds.length > 0) {
      return res.status(400).json({ error: `Product(s) with id(s) ${invalidProductIds.join(', ')} do not exist` });
    }

    const orderItems = items.map((item) => {
      const itemTotal = item.price * item.quantity;
      const itemGST = (item.price * item.gst_rate * item.quantity) / 100;
      totalAmount += itemTotal;
      gstAmount += itemGST;
      
      const sale_price = item.price === '' ? 0 : parseFloat(item.price);
      const quantity = item.quantity === '' ? 0 : parseFloat(item.quantity);
      const gst = item.gst_rate === '' ? 0 : parseFloat(item.gst_rate);
      const offer = item?.offer === '' ? 0 : parseFloat(item?.offer);
      const totalwithGst = ((sale_price * quantity) + (((sale_price * quantity) * gst)/100))
      const offerAmount = (totalwithGst * (offer/100));

      offerTotal += offerAmount

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        gst: item.gst_rate,
        weight: item.weight,
        unit: item.unit,
        offer: item.offer,
        // gst: item.color,
        total: itemTotal + itemGST,
      };
    });

    // Create Order
    const order = await db.Order.create({
      user_id,
	  status,
	  payment_status,
    comments,
      total_amount: totalAmount,
      gst_amount: gstAmount,
      grand_total: totalAmount + gstAmount,
      offer:  offerTotal,
    });

    // Add Items
    await db.OrderItem.bulkCreate(
      orderItems.map((item) => ({ ...item, order_id: order.id }))
    );
    // await sendEmail({ userData: userData, items: items });
    res.status(201).json({ message: 'Order created successfully!', order });
  } catch (error) {
    console.error(error);  // For debugging purposes
    res.status(500).json({ error: error.message });
  }
};

const createUserOrder = async (req, res) => {
  const { user_id, status, payment_status, comments, items, userData, statusType } = req.body;

  try {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    let totalAmount = 0;
    let gstAmount = 0;
    let offerTotal = 0;

    // Separate items into variant-based and plain products
    const variantProductIds = items
      .filter(item => item.variantId)
      .map(item => item.product_id);

    const plainProductIds = items
      .filter(item => !item.variantId)
      .map(item => item.product_id);

    // Fetch products from respective tables
    const variantProducts = await db.Variant.findAll({
      where: { product_id: variantProductIds }
    });

    const plainProducts = await db.Product.findAll({
      where: { id: plainProductIds }
    });

    const validVariantProductIds = variantProducts.map(p => p.product_id);
    const validPlainProductIds = plainProducts.map(p => p.id);
    const allValidIds = [...validVariantProductIds, ...validPlainProductIds];

    const allProductIds = items.map(item => item.product_id);
    const invalidProductIds = allProductIds.filter(id => !allValidIds.includes(id));

    if (invalidProductIds.length > 0) {
      return res.status(400).json({
        error: `Product(s) with id(s) ${invalidProductIds.join(', ')} do not exist`
      });
    }

    const orderItems = items.map(item => {
      const price = item.price === '' ? 0 : parseFloat(item.price);
      const quantity = item.quantity === '' ? 0 : parseFloat(item.quantity);
      const gst = item.gst_rate === '' ? 0 : parseFloat(item.gst_rate);
      const offer = item.offer === '' ? 0 : parseFloat(item.offer);

      const itemTotal = price * quantity;
      const itemGST = (itemTotal * gst) / 100;
      const totalWithGst = itemTotal + itemGST;
      const offerAmount = (totalWithGst * offer) / 100;

      totalAmount += itemTotal;
      gstAmount += itemGST;
      offerTotal += offerAmount;

      return {
        product_id: item.product_id,
        quantity: quantity,
        price: price,
        gst: gst,
        variantId: item.variantId || null,
        offer: offer,
        dimensions: item.dimensions || null,
        total: totalWithGst
      };
    });

    // Create Order
    const order = await db.Order.create({
      user_id,
      status,
      payment_status,
      comments,
      total_amount: totalAmount,
      gst_amount: gstAmount,
      grand_total: totalAmount + gstAmount,
      offer: offerTotal,
      statusType: statusType
    });

    // Insert order items
    await db.OrderItem.bulkCreate(
      orderItems.map(item => ({
        ...item,
        order_id: order.id
      }))
    );

    // Optionally send confirmation email
    // await sendEmail({ userData, items });

    res.status(201).json({ message: 'Order created successfully!', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};



const updateOrder = async (req, res) => {
  const { order_id, status, payment_status, comments, items, userData } = req.body;

  try {
    // Validate order existence
    const order = await db.Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Ensure items are present and valid
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Validate products in the items
    const productIds = items.map((item) => item.product_id);
    const products = await db.Product.findAll({ where: { id: productIds } });

    const productIdsInDb = products.map((product) => product.id);
    const invalidProductIds = productIds.filter((id) => !productIdsInDb.includes(id));

    if (invalidProductIds.length > 0) {
      return res.status(400).json({ error: `Product(s) with id(s) ${invalidProductIds.join(', ')} do not exist` });
    }

    // Recalculate totals and prepare updated items
    let totalAmount = 0;
    let gstAmount = 0;
    let offerTotal = 0;

    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      const itemGST = (item.price * item.gst_rate * item.quantity) / 100;
      totalAmount += itemTotal;
      gstAmount += itemGST;

      const sale_price = parseFloat(item.price) || 0;
      const quantity = parseFloat(item.quantity) || 0;
      const gst = parseFloat(item.gst_rate) || 0;
      const offer = parseFloat(item.offer) || 0;

      const totalWithGst = (sale_price * quantity) + ((sale_price * quantity * gst) / 100);
      const offerAmount = (totalWithGst * (offer / 100));
      offerTotal += offerAmount;

      // Upsert order item (Insert if not exists, Update if exists)
      await db.OrderItem.upsert({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        offer: item.offer,
        price: item.price,
        gst: item.gst_rate,
        total: itemTotal + itemGST,
        dimensions: item.dimensions,
        id:item.id,
        variantId: item.variantId
      }, {
        where: {
          order_id: order.id,
          product_id: item.product_id,
        }
      });
    }

    // Update order details
    order.total_amount = totalAmount;
    order.gst_amount = gstAmount;
    order.grand_total = totalAmount + gstAmount;
    order.offer = offerTotal;
    order.status = status;
    order.payment_status = payment_status;
    order.comments = comments;

    await order.save();

    res.status(200).json({ message: 'Order updated successfully!', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const quotationUpdate = async (req, res) => {
  const { order_id, status, payment_status, comments, items, userData, statusType } = req.body;

  try {
    // Validate order existence
    const order = await db.Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Ensure items are present and valid
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Validate products in the items
    const productIds = items.map((item) => item.product_id);
    const products = await db.Product.findAll({ where: { id: productIds } });

    const productIdsInDb = products.map((product) => product.id);
    const invalidProductIds = productIds.filter((id) => !productIdsInDb.includes(id));

    if (invalidProductIds.length > 0) {
      return res.status(400).json({ error: `Product(s) with id(s) ${invalidProductIds.join(', ')} do not exist` });
    }

    // Recalculate totals and prepare updated items
    let totalAmount = 0;
    let gstAmount = 0;
    let offerTotal = 0;

    // Loop through the items
for (const item of items) {
  const itemTotal = item.price * item.quantity;
  const itemGST = (item.price * item.gst_rate * item.quantity) / 100;
  totalAmount += itemTotal;
  gstAmount += itemGST;

  const sale_price = parseFloat(item.price) || 0;
  const quantity = parseFloat(item.quantity) || 0;
  const gst = parseFloat(item.gst_rate) || 0;
  const offer = parseFloat(item.offer) || 0;

  const totalWithGst = (sale_price * quantity) + ((sale_price * quantity * gst) / 100);
  const offerAmount = (totalWithGst * (offer / 100));
  offerTotal += offerAmount;

  if (item.deleted) {
    // Remove item if marked as deleted
    await db.OrderItem.destroy({
      where: {
        id: item.id,
      }
    });
  } else {
    // Upsert (Insert or Update) item if not deleted
    await db.OrderItem.upsert({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      offer: item.offer,
      price: item.price,
      gst: item.gst_rate,
      total: itemTotal + itemGST,
      dimensions: item.dimensions,
      id: item.id,
      variantId: item.variantId
    }, {
      where: {
        order_id: order.id,
        product_id: item.product_id,
      }
    });
  }
}


    // Update order details
    order.total_amount = totalAmount;
    order.gst_amount = gstAmount;
    order.grand_total = totalAmount + gstAmount;
    order.offer = offerTotal;
    order.status = status;
    order.payment_status = payment_status;
    order.comments = comments;
    order.statusType = statusType

    await order.save();
    res.status(200).json({ message: 'Order updated successfully!', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


// const updateUserOrder = async (req, res) => {
//   const { order_id, status, payment_status, comments, items, userData, statusType } = req.body;

//   try {
//     // Validate order existence
//     const order = await db.Order.findByPk(order_id);
//     if (!order) {
//       return res.status(404).json({ error: 'Order not found' });
//     }

//     // Ensure items are present and valid
//     if (!items || !Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({ error: 'Items array is required' });
//     }

//     // Validate products in the items
//     const productIds = items.map((item) => item.product_id);
//     const products = await db.Product.findAll({
//       where: { id: productIds },
//     });

//     const productIdsInDb = products.map((product) => product.id);
//     const invalidProductIds = productIds.filter((id) => !productIdsInDb.includes(id));

//     if (invalidProductIds.length > 0) {
//       return res.status(400).json({
//         error: `Product(s) with id(s) ${invalidProductIds.join(', ')} do not exist`,
//       });
//     }

//     // Recalculate totals and prepare updated items
//     let totalAmount = 0;
//     let gstAmount = 0;
//     let offerTotal = 0;
	
//     const updatedOrderItems = items.map((item) => {
//       // const itemTotal = item.price * item.quantity;
//       // const itemGST = (item.price * item.gst_rate * item.quantity) / 100;
//       // totalAmount += itemTotal;
//       // gstAmount += itemGST;

//       // const sale_price = item.price === '' ? 0 : parseFloat(item.price);
//       // const quantity = item.quantity === '' ? 0 : parseFloat(item.quantity);
//       // const gst = item.gst_rate === '' ? 0 : parseFloat(item.gst_rate);
//       // const offer = item?.offer === '' ? 0 : parseFloat(item?.offer);
//       // const totalwithGst = ((sale_price * quantity) + (((sale_price * quantity) * gst)/100))
//       // const offerAmount = (totalwithGst * (offer/100));

//       // offerTotal += offerAmount

//       return {
//         order_id: order.id,
// 		    product_id: item.product_id,
//         quantity: item.quantity,
//         weight: item.weight,
//         unit: item.unit,
//         offer: item.offer,
//         price: item.price,
//         gst: item.gst_rate,
//         total: 0,
//       };
//     });

//     // Update order details
//     order.total_amount = totalAmount;
//     order.gst_amount = gstAmount;
//     order.grand_total = totalAmount + gstAmount;
//     order.offer =  offerTotal;
// 	order.status = status,
// 	order.payment_status = payment_status,
//   order.comments = comments,
//   order.statusType = statusType,
//     await order.save();

//     // Update order items
//     await db.OrderItem.destroy({ where: { order_id: order.id } }); // Clear existing items
//     await db.OrderItem.bulkCreate(updatedOrderItems); // Add updated items
//     // await sendEmail({ userData: userData, items: items });
//     res.status(200).json({ message: 'Order updated successfully!', order });
//   } catch (error) {
//     console.error(error); // For debugging purposes
//     res.status(500).json({ error: error.message });
//   }
// };

const updateUserOrder = async (req, res) => {
  const { order_id, status, payment_status, comments, items, userData } = req.body;

  try {
    // Validate order existence
    const order = await db.Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Ensure items are present and valid
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Validate products in the items
    const productIds = items.map((item) => item.product_id);
    const products = await db.Product.findAll({ where: { id: productIds } });

    const productIdsInDb = products.map((product) => product.id);
    const invalidProductIds = productIds.filter((id) => !productIdsInDb.includes(id));

    if (invalidProductIds.length > 0) {
      return res.status(400).json({ error: `Product(s) with id(s) ${invalidProductIds.join(', ')} do not exist` });
    }

    // Recalculate totals and prepare updated items
    let totalAmount = 0;
    let gstAmount = 0;
    let offerTotal = 0;

    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      const itemGST = (item.price * item.gst_rate * item.quantity) / 100;
      totalAmount += itemTotal;
      gstAmount += itemGST;

      const sale_price = parseFloat(item.price) || 0;
      const quantity = parseFloat(item.quantity) || 0;
      const gst = parseFloat(item.gst_rate) || 0;
      const offer = parseFloat(item.offer) || 0;

      const totalWithGst = (sale_price * quantity) + ((sale_price * quantity * gst) / 100);
      const offerAmount = (totalWithGst * (offer / 100));
      offerTotal += offerAmount;

      // Upsert order item (Insert if not exists, Update if exists)
      await db.OrderItem.upsert({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        offer: item.offer,
        price: item.price,
        gst: item.gst_rate,
        total: itemTotal + itemGST,
        dimensions: item.dimensions,
        id:item.id,
        variantId: item.variantId
      }, {
        where: {
          order_id: order.id,
          product_id: item.product_id,
        }
      });
    }

    // Update order details
    order.total_amount = totalAmount;
    order.gst_amount = gstAmount;
    order.grand_total = totalAmount + gstAmount;
    order.offer = offerTotal;
    order.status = status;
    order.payment_status = payment_status;
    order.comments = comments;

    await order.save();

    res.status(200).json({ message: 'Order updated successfully!', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const deleteOrder = async (req, res) => {
  const { order_id } = req.params;
  try {
    // Validate order existence
    const order = await db.Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Delete associated order items
    await db.OrderItem.destroy({ where: { order_id } });

    // Delete the order
    await order.destroy();

    res.status(200).json({ message: 'Order deleted successfully!' });
  } catch (error) {
    console.error(error); // For debugging purposes
    res.status(500).json({ error: error.message });
  }
};

const getOrder = async (req, res) => {
  const { order_id } = req.body;

  try {
    if (order_id) {
      // Fetch specific order with its items
      const order = await db.Order.findByPk(order_id, {
        include: [
          {
            model: db.OrderItem,
            as: 'orderItems',
            include: [{ model: db.Product, as: 'product' }],
          },
        ],
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json(order);
    } else {
      // Fetch all orders
      const orders = await db.Order.findAll({
        include: [
          {
            model: db.OrderItem,
            as: 'orderItems',
            include: [{ model: db.Product, as: 'product' }],
          },
        ],
      });

      res.status(200).json(orders);
    }
  } catch (error) {
    console.error(error); // For debugging purposes
    res.status(500).json({ error: error.message });
  }
};
const getUsers = async (req, res) => {
  const {limit, offset, orderBy, filters} = req.body;
  try {
    const users = await db.User.findAndCountAll({
    where: filters, // Apply filters
      limit: parseInt(limit), // Apply limit
      offset: parseInt(offset), // Apply offset
      //order: orderBy.sort
  }); // Fetch all users
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const getAllOrders = async (req, res) => {
  const { limit, offset, orderBy, filters } = req.body;

  try {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const orderByCondition = [['createdAt', 'DESC']];
    const whereCondition = filters || {}; 

    // Fetch orders with pagination, ordering, and optional filtering
    const orders = await db.Order.findAndCountAll({
      include: [
        {
          model: db.OrderItem,
          include: [
            {
              model: db.Product,
              required: false, // Allow Product to be null in case there's no product associated
            },
          ],
        },
        {
          model: db.User,
          attributes: ['id', 'name', 'email', 'company', 'mobile_number'],
        },
      ],
      order: orderByCondition, // Apply the ordering condition
      where: whereCondition, // Apply the filters (or no filter if filters is null)
      limit: parsedLimit, // Apply pagination limit
      offset: parsedOffset, // Apply pagination offset
    });

    // If no orders are found, return a 404 error
    if (!orders || orders.rows.length === 0) {
      return res.status(404).json({ message: 'No orders found' });
    }

    // Map over the orders to return structured data
    res.status(200).json({
      orders: {
        count: orders.count, // Total number of orders
        rows: orders.rows.map((order) => ({
          id: order.id,
          user: order.User,
          totalAmount: parseInt(order.total_amount),
          gstAmount: parseInt(order.gst_amount),
          order_status: order.status,
          payment_status: order.payment_status,
          grandTotal: parseInt(order.grand_total),
          offer: parseInt(order.offer),
          items: order.OrderItems.map((item) => ({
            product_id: item.Product ? item.Product.id : null,
            product_name: item.Product ? item.Product.name : null,
            company: item.Product ? item.Product.company : null,
            quantity: parseInt(item.quantity),
            weight: item.weight,
            sale_price: parseInt(item.price),
            gst: parseInt(item.gst),
            unit: item.unit,
            offer: parseInt(item.offer),
            total: parseInt(item.total),
          })),
          createdAt: order.createdAt,
        })),
      },
    });
  } catch (error) {
    // Catch any errors and return a 500 status
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// const getAllOrdersAdmin = async (req, res) => {
//   const { limit, offset, orderBy, filters } = req.body;

//   try {
//     const parsedLimit = limit ? parseInt(limit, 10) : 10;
//     const parsedOffset = offset ? parseInt(offset, 10) : 0;
//     const orderByCondition = [['createdAt', 'DESC']];
//     const whereCondition = filters || {}; 

//     // Fetch orders with pagination, ordering, and optional filtering
//     const orders = await db.Orderwebsite.findAndCountAll({
//       include: [
//         {
//           model: db.User,
//           as: 'user',
//           attributes: ['id', 'name', 'email', 'company', 'mobile_number'],
//         },
//       ],
//       order: orderByCondition, // Apply the ordering condition
//       where: whereCondition, // Apply the filters (or no filter if filters is null)
//       limit: parsedLimit, // Apply pagination limit
//       offset: parsedOffset, // Apply pagination offset
//     });

//     // If no orders are found, return a 404 error
//     if (!orders || orders.rows.length === 0) {
//       return res.status(404).json({ message: 'No orders found' });
//     }

//     // Map over the orders to return structured data
//     res.status(200).json({
//       orders: {
//         count: orders.count, // Total number of orders
//         rows: orders.rows.map((order) => ({
//           id: order.id,
//           user: order.user, // ✅ lowercase alias
//           totalAmount: parseInt(order.total_amount),
//           gstAmount: parseInt(order.gst_amount),
//           order_status: order.status,
//           payment_status: order.payment_status,
//           grandTotal: parseInt(order.grand_total),
//           offer: parseInt(order.offer),
//           createdAt: order.createdAt,
//         })),
//       },
//     });
//   } catch (error) {
//     // Catch any errors and return a 500 status
//     console.error(error);
//     res.status(500).json({ error: error.message });
//   }
// };

const getAllOrdersAdmin = async (req, res) => {
 try {
    const { limit = 10, offset = 0 } = req.body;

    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);

    const orders = await db.Orderwebsite.findAndCountAll({
      limit: parsedLimit,
      offset: parsedOffset,
      attributes: [
        'id',
        'order_id',
        'status',
        'payment_status',
        'amount',
        'shipping',
        'created_at',
      ],
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name','mobile_number'],
        },
      ],
      order: [['id', 'DESC']],
    });

    res.status(200).json({
      orders: {
        count: orders.count,
        rows: orders.rows.map(o => ({
          id: o.id,
          orderNo: o.order_id || o.id,
          customer: o.user?.name || 'Guest',
          mobile: o.user?.mobile_number || '',
          orderDate: o.created_at,
          orderStatus: o.status,
          paymentStatus: o.payment_status,
          shipping: o.shipping,
          total: Number(o.amount),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const getUserOrders = async (req, res) => {
  const { limit, offset, orderBy, filters } = req.body;
  // const modifyFilter = {...filters, 'statusType': 'Ordered'}
  try {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const orderByCondition = [['createdAt', 'DESC']];    
    const whereCondition = filters || {}; 

    const totalCount = await db.Order.count({
      where: whereCondition,
      distinct: true,
      col: "id",
    });

    // Fetch orders with pagination, ordering, and optional filtering
    const orders = await db.Order.findAll({
      attributes: ["id", "total_amount", "gst_amount", "status", "payment_status", "grand_total", "offer", "createdAt", "statusType"],
      subQuery: false, // Ensures correct row count
      include: [
        {
          model: db.OrderItem,
          attributes: ["quantity", "price", "gst", "offer", "total"],
          include: [
            {
              model: db.Product,
              required: false, // Allow Product to be null in case there's no product associated
            },
          ],
        },
        {
          model: db.User,
          attributes: ['id', 'name', 'email', 'company', 'mobile_number'],
        },
      ],
      order: orderByCondition, // Apply the ordering condition
      where: whereCondition, // Apply the filters (or no filter if filters is null)
      limit: parsedLimit, // Apply pagination limit
      offset: parsedOffset, // Apply pagination offset
      // group: ["Order.id"],
    });

    // If no orders are found, return a 404 error
    if (!orders || orders?.length === 0) {
      return res.status(200).json({ message: 'No orders found' });
    }

    // Map over the orders to return structured data
    res.status(200).json({
      orders: {
        count: totalCount, // Total number of orders
        rows: orders?.map((order) => ({
          id: order.id,
          user: order.User,
          totalAmount: parseInt(order.total_amount),
          gstAmount: parseInt(order.gst_amount),
          order_status: order.status,
          payment_status: order.payment_status,
          grandTotal: parseInt(order.grand_total),
          offer: parseInt(order.offer),
          statusType: order.statusType,
          items: order.OrderItems.map((item) => ({
            product_id: item.Product ? item.Product.id : null,
            product_name: item.Product ? item.Product.name : null,
            company: item.Product ? item.Product.company : null,
            quantity: parseInt(item.quantity),
            sale_price: parseInt(item.price),
            gst: parseInt(item.gst),
            offer: parseInt(item.offer),
            total: parseInt(item.total),
          })),
          createdAt: order.createdAt,
        })),
      },
    });
  } catch (error) {
    // Catch any errors and return a 500 status
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const sendEmail = async (data) => {
  const message  = 'Order List are below as attachment download the file';
  const to = data?.userData[0]?.email;
  const subject = "Filtered Product Data";
    const tableRows = data.items
    .map(
      (item) =>
        `<tr>
          <td>${item.product_id}</td>
          <td>${item.price}</td>
          <td>${item.gst_rate}</td>
          <td>${item.weight}</td>
          <td>${item.unit}</td>
          <td>${item.quantity}</td>
        </tr>`
    )
    .join("");
    const emailContent = `
    <h2>${message}</h2>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr>
        <th>Product ID</th>
        <th>Price</th>
        <th>GST Rate</th>
        <th>Weight</th>
        <th>Unit</th>
        <th>Quantity</th>
      </tr>
      ${tableRows}
    </table>
  `;

  // Configure Nodemailer
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "bhavna87satti@gmail.com", // Replace with your email
      pass: "9899457784", // Replace with your email password (use environment variables)
    },
  });

  let mailOptions = {
    from: "bhavna87satti@gmail.com",
    to,
    subject,
    html: emailContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    return;
  } catch (error) {
    console.error("Error sending email:", error);
    return
  }
};

const getSingleOrder = async (req, res) => {
  const { orderId } = req.body; // Extract orderId from request parameters

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  try {
    const order = await db.Order.findOne({
      where: { id: orderId }, // Filter by order ID
      attributes: ["id", "total_amount", "gst_amount", "status", "payment_status", "grand_total", "offer", "createdAt", "statusType"],
      include: [
        {
          model: db.OrderItem,
          attributes: ["id", "quantity", "price", "gst", "dimensions", "total"],
          include: [
            {
              model: db.Product,
              attributes: ["id", "name", "company"],
              required: false, // Allow Product to be null
            },
          ],
        },
        {
          model: db.User,
          attributes: ["id", "name", "email", "company", "mobile_number"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Return structured response
    res.status(200).json({
      order: {
        id: order.id,
        user: order.User,
        totalAmount: parseInt(order.total_amount),
        gstAmount: parseInt(order.gst_amount),
        order_status: order.status,
        payment_status: order.payment_status,
        grandTotal: parseInt(order.grand_total),
        offer: parseInt(order.offer),
        statusType: order.statusType,
        items: order.OrderItems.map((item) => ({
          product_id: item.Product ? item.Product.id : null,
          // product_name: item.Product ? item.Product.name : null,
          name: item.Product ? item.Product.name : null,
          company: item.Product ? item.Product.company : null,
          quantity: parseInt(item.quantity),
          sale_price: parseInt(item.price),
          gst: parseInt(item.gst),
          total: parseInt(item.total),
          dimensions: item.dimensions,
          id: item.id
        })),
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: error.message });
  }
};


// const getSingleOrderAdmin = async (req, res) => {
//   const { orderId } = req.body;

//   if (!orderId) {
//     return res.status(400).json({ message: "Order ID is required" });
//   }
//   try {
//     const order = await db.Orderwebsite.findOne({
//       where: { id: orderId },
//       attributes: [
//         "id",
//         "amount",
//         "address",
//         "status",
//         "payment_status",
//         "order_id",
//         "shipping"
//       ],
//       include: [
//   {
//     model: db.OrderWebsiteItems,
//     as: 'orderItems',
//     include: [
//       {
//         model: db.Variant,
//         as: 'variantOrder',
//         include: [
//           {
//             model: db.Product,
//             as: 'product',
//           },
//         ],
//       },
//     ],
//   },
//   {
//     model: db.User,
//     as: 'user', // ✅ REQUIRED
//     attributes: ['id', 'name', 'email', 'company', 'mobile_number'],
//   },
// ]

//     });

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     res.status(200).json({
//       order: {
//         id: order.id,
//         user: order.User,
//         totalAmount: Number(order.amount),
//         status: order.status,
//         payment_status: order.payment_status,
//         grandTotal: Number(order.grand_total),
//         offer: Number(order.offer),
//         statusType: order.statusType,
//         items: order.orderItems.map(item => {
//           const variant = item.variantOrder;
//           const product = variant?.product;

//           return {
//             id: item.id,
//             variant_id: item.variant_id,
//             product_id: product?.id || null,
//             product_name: product?.name || null,
//             company: product?.company || null,
//             quantity: Number(item.quantity),
//             sale_price: product ? Number(product.sale_price) : 0,
//             price: product ? Number(product.price) : 0,
//             gst: product ? Number(product.gst_rate) : 0,
//             total: Number(item.total),
//             offer: Number(item.offer),
//             dimensions: item.dimensions,
//             variant: variant
//               ? {
//                   id: variant.id,
//                   stock: variant.stock,
//                   sale_price: variant.sale_price,
//                   dimensions: variant.dimensions,
//                 }
//               : null,
//           };
//         }),
//         createdAt: order.createdAt,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching order:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

const getSingleOrderAdmin = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: 'Order ID required' });
  }

  try {
    const order = await db.Orderwebsite.findOne({
      where: { id: orderId },
      attributes: [
        'id',
        'order_id',
        'status',
        'payment_status',
        'address',
        'shipping',
        'created_at',
      ],
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['name', 'email', 'mobile_number', 'company'],
        },
        {
          model: db.OrderWebsiteItems,
          as: 'orderItems',
          attributes: [
            'id',
            'variant_id',
            'quantity',
            'price',
            'gst',
            'total',
            'sku',
            'title',
            'dimType',
            'dimValue',
            'dimunitName',
            'status',
            'payment_status',
          ],
          include: [
            {
              model: db.Variant,
              as: 'variantOrder',
              attributes: ['id', 'stock', 'sale_price'],
              include: [
                {
                  model: db.Product,
                  as: 'product',
                  attributes: ['id', 'name', 'gst_rate'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      order: {
        id: order.id,
        orderNo: order.order_id,
        status: order.status,
        payment_status: order.payment_status,
        createdAt: order.created_at,
        customer: order.user,
        shipping: order.shipping,
        items: order.orderItems.map(i => ({
          id: i.id,
          product_name: i.title,
          sku: i.sku,
          status: i.status,
          paymentStatus: i.payment_status,
          dimension: `${i.dimType} ${i.dimValue} ${i.dimunitName}`,
          quantity: i.quantity,
          price: Number(i.price),
          gst: Number(i.gst),
          total: Number(i.total),
          variant: i.variantOrder
            ? {
                id: i.variantOrder.id,
                stock: i.variantOrder.stock,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const ALLOWED_ITEM_STATUS = [
  'PENDING',
  'BOOKED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
];

const updateOrderAdmin = async (req, res) => {
  const { id, status, payment_status, items } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Order ID is required' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order items are required' });
  }

  const ITEM_STATUS = [
    'PENDING',
    'BOOKED',
    'PACKED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'RETURNED'
  ];

  const ORDER_STATUS = [...ITEM_STATUS];

  const PAYMENT_STATUS = [
    'PENDING',
    'PAID',
    'UNPAID',
    'FREE',
    'FAILED',
    'RETURNED'
  ];

  const transaction = await db.sequelize.transaction();

  try {
    /* ---------- 1. Update items ---------- */
    for (const item of items) {

      if (!ITEM_STATUS.includes(item.status)) {
        throw new Error(`Invalid item status: ${item.status}`);
      }

      const itemPaymentStatus =
        item.paymentStatus ??
        item.payment_status ??
        item.payment_staus ??
        'PENDING';

      if (!PAYMENT_STATUS.includes(itemPaymentStatus)) {
        throw new Error(`Invalid item payment status: ${itemPaymentStatus}`);
      }

      await db.OrderWebsiteItems.update(
        {
          status: item.status,
          payment_status: itemPaymentStatus
        },
        {
          where: { id: item.id, order_id: id },
          transaction
        }
      );
    }

    /* ---------- 2. Count item statuses ---------- */
    const totalItems = await db.OrderWebsiteItems.count({
      where: { order_id: id },
      transaction
    });

    const statusCounts = await db.OrderWebsiteItems.findAll({
      attributes: [
        'status',
        [db.sequelize.fn('COUNT', db.sequelize.col('status')), 'count']
      ],
      where: { order_id: id },
      group: ['status'],
      raw: true,
      transaction
    });

    const statusMap = Object.fromEntries(
      statusCounts.map(s => [s.status, Number(s.count)])
    );

    /* ---------- 3. FINAL ORDER STATUS (FIXED) ---------- */
    let finalStatus;

    if (status) {
      // ADMIN OVERRIDE — highest priority
      finalStatus = status;
    } else if (statusMap.RETURNED === totalItems) {
      finalStatus = 'RETURNED';
    } else if (statusMap.CANCELLED === totalItems) {
      finalStatus = 'CANCELLED';
    } else if (statusMap.DELIVERED === totalItems) {
      finalStatus = 'DELIVERED';
    } else if ((statusMap.SHIPPED || 0) > 0) {
      finalStatus = 'SHIPPED';
    } else if ((statusMap.BOOKED || 0) > 0) {
      finalStatus = 'BOOKED';
    } else {
      finalStatus = 'PENDING';
    }

    if (!ORDER_STATUS.includes(finalStatus)) {
      throw new Error(`Invalid order status: ${finalStatus}`);
    }

    /* ---------- 4. Payment aggregation ---------- */
    const paymentCounts = await db.OrderWebsiteItems.findAll({
      attributes: [
        'payment_status',
        [db.sequelize.fn('COUNT', db.sequelize.col('payment_status')), 'count']
      ],
      where: { order_id: id },
      group: ['payment_status'],
      raw: true,
      transaction
    });

    const paymentMap = Object.fromEntries(
      paymentCounts.map(p => [p.payment_status, Number(p.count)])
    );

    /* ---------- 5. FINAL PAYMENT STATUS (FIXED) ---------- */
    let finalPaymentStatus =
      payment_status ??
      (paymentMap.PAID === totalItems ? 'PAID' : 'PENDING');

    if ((paymentMap.RETURNED || 0) > 0) {
      finalPaymentStatus = 'RETURNED';
    }

    if (!PAYMENT_STATUS.includes(finalPaymentStatus)) {
      throw new Error(`Invalid payment status: ${finalPaymentStatus}`);
    }

    /* ---------- 6. Update main order ---------- */
    await db.Orderwebsite.update(
      {
        status: finalStatus,
        payment_status: finalPaymentStatus
      },
      { where: { id }, transaction }
    );

    await transaction.commit();

    return res.json({ message: 'Order updated successfully' });

  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};


module.exports = { createOrder, updateOrder, deleteOrder, getOrder, getAllOrders, getUserOrders, createUserOrder, updateUserOrder, getSingleOrder, getAllOrdersAdmin, getSingleOrderAdmin, quotationUpdate, updateOrderAdmin };
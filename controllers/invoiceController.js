// controllers/categoryController.js
const db = require("../models");
const { Order, Product, User, OrderItem } = require('../models');

// Create a new category
const generateInvoice = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await db.Orderwebsite.findOne({
      where: { id: orderId },
      include: [
        {
          model: db.OrderWebsiteItems,
          as: 'orderItems',
          include: [
            {
              model: db.Variant,
              as: 'variantOrder',
              include: [
                {
                  model: db.Product,
                  as: 'product',
                }
              ]
            }
          ]
        },
        {
          model: db.User,
          as: 'user',
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    /* -------------------------------
       Invoice Item Calculation
    --------------------------------*/
    const items = order.orderItems.map((item) => {
      const price = Number(item.price);
      const gstPercent = Number(item.gst);
      const quantity = Number(item.quantity || 1);

      const baseAmount = price * quantity;
      const gstAmount = baseAmount * (gstPercent / 100);
      const total = Number((baseAmount + gstAmount).toFixed(2));

      return {
        productName: item.variantOrder?.displayTitle,
        quantity,
        price,
        gst: gstPercent,
        gstAmount: Number(gstAmount.toFixed(2)),
        total,
      };
    });

    /* -------------------------------
       Totals
    --------------------------------*/
    const subTotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const totalGst = items.reduce((sum, i) => sum + i.gstAmount, 0);
    const shipping = Number(order.shipping || 0);
    const grandTotal = Number((subTotal + totalGst + shipping).toFixed(2));

    /* -------------------------------
       Invoice Data
    --------------------------------*/
    const invoiceData = {
      orderId: order.id,
      createdAt: order.createdAt,
      client: {
        name: order.user.name,
        email: order.user.email,
        company: order.user.company,
        gstin: order.user.gstin,
        mobile: order.user.mobile_number,
        address: order.address,
      },
      items,
      totals: {
        subTotal: Number(subTotal.toFixed(2)),
        gst: Number(totalGst.toFixed(2)),
        shipping,
        grandTotal,
      },
    };

    res.status(200).json({ invoice: invoiceData });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


module.exports = { generateInvoice };

// controllers/searchController.js
const { Op } = require('sequelize');
const db = require('../models');
const { User, Product } = require('../models');
	
// Fetch All Users
const searchUsers = async (req, res) => {
	
  try {
  const {limit, offset, orderBy, filters} = req.body;
	const searchableFields = ['name', 'email', 'mobile_number', 'address', 'client_status', 'company'];

	const searchConditions = {
	  [Op.or]: searchableFields.map((field) => ({
		[field]: { [Op.like]: `%${filters}%` }, // Case-insensitive partial match
	  })),
	};
    const users = await db.User.findAndCountAll({
	  where: filters ? searchConditions : undefined, // Apply filters
      limit: parseInt(limit), // Apply limit
      offset: parseInt(offset), // Apply offset
      //order: orderBy.sort
	}); // Fetch all users
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const searchProduct = async (req, res) => {
	
  try {
  const {limit, offset, orderBy, filters} = req.body;
	const searchableFields = ['name', 'company'];

	const searchConditions = {
	  [Op.or]: searchableFields.map((field) => ({
		[field]: { [Op.like]: `%${filters}%` }, // Case-insensitive partial match
	  })),
	};
    const products = await db.Product.findAndCountAll({
      distinct: true,
      include: [
        {
                  model: db.Category,
                  as: 'category',
                  attributes: ['id', 'name'],
                  include: [
                    {
                      model: db.Subcategory,
                      as: 'subcategories',
                      attributes: ['id', 'name'],
                    },
                  ]
                },
      ],
	  where: filters ? searchConditions : undefined, // Apply filters
      limit: parseInt(limit), // Apply limit
      offset: parseInt(offset), // Apply offset
      distinct: true,
      //order: orderBy.sort
	}); // Fetch all users

  const productsWithDealers = await Promise.all(
    products.rows.map(async (product) => {
      const dealerIds = product.dealer_id.split(',').map(Number); // Split and convert to integers
      const dealers = await db.Dealer.findAll({
        where: { id: dealerIds },
        attributes: ['id', 'name', 'email', 'mobile_number', 'address', 'dealer_status', 'company'],
      });

      return {
        ...product.toJSON(),
        dealers,
      };
    })
  );
  res.status(200).json({ products: {
    count: products.count,
    rows: productsWithDealers
  }});
    // res.status(200).json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const searchOrder = async (req, res) => {
  try {
    const { limit, offset, orderBy, filters } = req.body;
    const searchableFields = ['payment_status', 'status'];

    // Construct search conditions based on filters
    const searchConditions = filters
      ? {
          [Op.or]: searchableFields.map((field) => ({
            [field]: { [Op.like]: `%${filters}%` }, // Case-insensitive partial match
          })),
        }
      : undefined;

    // Fetch orders with filters, pagination, and ordering
    const orders = await db.Order.findAndCountAll({
      where: searchConditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: orderBy ? [[orderBy.field, orderBy.direction]] : undefined,
    });

    // Fetch associated data for each order
    const formattedOrders = await Promise.all(
      orders.rows.map(async (order) => {
        // Fetch user details
        const user = await db.User.findOne({
          where: { id: order.user_id },
          attributes: ['id', 'name', 'email', 'mobile_number', 'company'],
        });

        // Fetch order items
        const items = await db.Order.findAll({
          where: { id: order.id },
          // attributes: ['product_id', 'product_name', 'company', 'quantity', 'weight', 'unit', 'sale_price', 'gst', 'total'],
          attributes: ['status', 'payment_status'],
        });

        return {
          id: order.id,
          user: user ? user.toJSON() : null,
          totalAmount: order.totalAmount,
          gstAmount: order.gstAmount,
          order_status: order.status,
          payment_status: order.payment_status,
          comments: order.comments,
          grandTotal: order.grandTotal,
          items: items.map((item) => item.toJSON()), // Convert items to JSON format
          createdAt: order.createdAt,
        };
      })
    );

    // Respond with formatted data
    res.status(200).json({
      orders: {
        count: orders.count,
        rows: formattedOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const searchDealers = async (req, res) => {
	
  try {
  const {limit, offset, orderBy, filters} = req.body;
	const searchableFields = ['name', 'email', 'mobile_number', 'address', 'dealer_status', 'company'];

	const searchConditions = {
	  [Op.or]: searchableFields.map((field) => ({
		[field]: { [Op.like]: `%${filters}%` }, // Case-insensitive partial match
	  })),
	};
    const dealers = await db.Dealer.findAndCountAll({
	  where: filters ? searchConditions : undefined, // Apply filters
      limit: parseInt(limit), // Apply limit
      offset: parseInt(offset), // Apply offset
      //order: orderBy.sort
	}); // Fetch all users
    res.status(200).json({ dealers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const searchUserProduct = async (req, res) => {
	
  try {
  const {limit, offset, orderBy, filters} = req.body;
	const searchableFields = ['name', 'company'];

	const searchConditions = {
	  [Op.or]: searchableFields.map((field) => ({
		[field]: { [Op.like]: `%${filters}%` }, // Case-insensitive partial match
	  })),
	};
    const products = await db.Product.findAndCountAll({
      distinct: true,
            include: [
              {
                        model: db.Variant,
                        as: "variants",
                        required: false,
                        attributes: ["id", "colour", "dimensions", "materials", "sale_price", "colour","stock"]
              },
              {
                model: db.ProductImage,
                as: "imagesT",
                attributes: ["id", "image_url", "public_id", "product_id"],
              },
              {
                model: db.Category,
                as: "category",
                attributes: ["id", "name"],
              },
            ],
	  where: filters ? searchConditions : undefined, // Apply filters
      limit: parseInt(limit), // Apply limit
      offset: parseInt(offset), // Apply offset
      //order: orderBy.sort
	}); // Fetch all users

  // const productsWithDealers = await Promise.all(
  //   products.rows.map(async (product) => {
  //     const dealerIds = product.dealer_id.split(',').map(Number); // Split and convert to integers
  //     const dealers = await db.Dealer.findAll({
  //       where: { id: dealerIds },
  //       attributes: ['id', 'name', 'email', 'mobile_number', 'address', 'dealer_status', 'company'],
  //     });

  //     return {
  //       ...product.toJSON(),
  //       dealers,
  //     };
  //   })
  // );
  const productsWithDealers = await Promise.all(
    products.rows.map(async (product) => {
      const companyid = product?.company ? product?.company : null;
      const dealerIds = product.dealer_id
        ? product.dealer_id.split(",").map(Number).filter((id) => !isNaN(id))
        : [];

      const dealers = dealerIds.length
        ? await db.Dealer.findAll({
            where: { id: { [Op.in]: dealerIds } },
            attributes: ["id", "name", "company", "email", "mobile_number", "dealer_status"],
          })
        : [];

      const companyName =  await db.companyNew.findAll({
        where: {company_id: companyid},
        attributes: ["company_id", "name"],
      })          
      return { ...product.toJSON(), dealers, companyName };
    })
    );
    const diamensionType =  await db.dimensionType.findAll({
      attributes: ["id", "name"],
    })

    const diamensionUnit =  await db.dimensionUnit.findAll({
      attributes: ["id", "name"],
  })
  res.status(200).json({ products: {
    count: products.count,
    rows: productsWithDealers,
    diamensionType: diamensionType,
    diamensionUnit: diamensionUnit
  }});
    // res.status(200).json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const brandlist = async (req, res) => {
	
  try {
    const brand = await db.companyNew.findAll();	  
    res.status(200).json({ brand });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { searchUsers, searchProduct, searchDealers, searchOrder, searchUserProduct, brandlist };
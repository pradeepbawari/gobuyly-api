// controllers/productsController.js
const db = require("../models");
const { Product, Dealer, Category, Color, Weight, Variant } = require("../models");
const { Op, where } = require('sequelize');
const subcategory = require("../models/subcategory");

const createProducts = async (req, res) => {
  try {
    const { 
      name, 
      stock, 
      gst_rate, 
      price, 
      sale_price, 
      category_id, 
      dealer_id, 
      company, 
      discription,
      variants,
      subcategory_id
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name and at least one variant are required' });
    }

    // 1. Create the product
    const product = await db.Product.create({ 
      name, 
      stock, 
      gst_rate, 
      price, 
      sale_price, 
      category_id, 
      dealer_id, 
      company,
      discription,
      subcategory_id
    });
    const productId = product.id;

    // 2. Handle dealer associations
    if (dealer_id && dealer_id.length > 0) {
      const productDealerAssociations = dealer_id.map((dealerId) => ({
        product_id: productId,
        dealer_id: dealerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      await db.ProductDealers.bulkCreate(productDealerAssociations);
    }

    // 3. Process variants
    if (productId &&variants || variants.length > 0) {
      const variantPromises = variants.map(async (variant) => {
        const { price, sale_price, stock, deleted, materials, colour, dimensions, sku, color_id, company_id } = variant;
        // Create product variant
        return db.Variant.create({
          product_id: productId,
          colour,
          price,
          sale_price,
          stock,
          materials,
          deleted,
          dimensions,
          sku,
          color_id,
          company_id
        });              
      });
  
      await Promise.all(variantPromises);  
    }
    
    const productWithDealers = await fetchAfterUpdate(productId);

    // Response
    res.status(201).json({ 
      message: 'Product created successfully', 
      productWithDealers,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const fetchAfterUpdate = async (productId) => {
  try {
    const fullProduct = await db.Product.findOne({
      where: { id: productId },
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: db.Variant,
          as: "variants",
          required: false,
          attributes: ["id", "colour", "dimensions", "materials", "sale_price", "color_id","stock","company_id","sku"]
        },
      ],
    });

    const productWithDealers = await Promise.all(
      [fullProduct].map(async (product) => {
        const dealerIds = product.dealer_id.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id)); // Parse dealer_id string
        const dealers = await db.Dealer.findAll({
          where: {
            id: {
              [Op.in]: dealerIds, // Fetch all dealers with parsed IDs
            },
          },
          attributes: ['id', 'name', 'company', 'email', 'mobile_number', 'dealer_status'],
        });
        return { ...product.toJSON(), dealers }; // Add dealers to product
      })
    );
    return productWithDealers;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

const getAllProducts = async (req, res) => {
  const { limit, offset, orderBy, filters } = req.body;
  const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    // const orderByCondition = [['createdAt', 'DESC']];
    const orderByCondition = [[orderBy[0].colId, orderBy[0].sort]];
    const whereCondition = filters || {}; 
  try {
    // Step 1: Fetch all products with associations
    const products = await db.Product.findAndCountAll({
      distinct: true,  // Ensure distinct count of products
      include: [
        {
          model: db.ProductImage,
          as: 'imagesT',
          attributes: ['id', 'image_url', 'public_id', 'product_id'],
        },
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
      order: orderByCondition, // Apply the ordering condition
      where: whereCondition, // Apply the filters (or no filter if filters is null)
      limit: parsedLimit, // Apply pagination limit
      offset: parsedOffset, // Apply pagination offset
      distinct: true,  // Add this to fix duplicate count issue
      col: 'id' // Ensures distinct is applied correctly on primary key
    });
    
    // Post-process each product to fetch dealers based on dealer_id string
    const productWithDealers = await Promise.all(
      products.rows.map(async (product) => {
        const dealerIds = product.dealer_id.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id)); // Parse dealer_id string
        const dealers = await db.Dealer.findAll({
          where: {
            id: {
              [Op.in]: dealerIds, // Fetch all dealers with parsed IDs
            },
          },
          attributes: ['id', 'name', 'company', 'email', 'mobile_number', 'dealer_status'],
        });
        return { ...product.toJSON(), dealers }; // Add dealers to product
      })
    );

    res.json({ products: {
        count: products.count,
        rows: productWithDealers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

const updateProducts = async (req, res) => {
  try {
    const { id, name, stock, gst_rate, price, sale_price, category_id, dealer_id, company, discription, variants, subcategory_id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Product ID is required for updating.' });
    }
    // 1. Update the main product details
    const product = await db.Product.update(
      { name, stock, gst_rate, price, sale_price, category_id, dealer_id, company, discription, subcategory_id },
      { where: { id } }
    );

    if (!product[0]) { // Sequelize returns an array, where [0] is the number of affected rows
      return res.status(404).json({ error: 'Product not found.' });
    }

    // 2. Update Variants
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        const { variant_id, price, sale_price, stock, deleted, materials, dimensions, colour, color_id, company_id, sku } = variant;

        // Check if the variant exists
        if (variant_id) {
          if (deleted === true) {
            console.log(`Deleting variant with ID: ${variant_id}`);
            await db.Variant.destroy({ where: { id: variant_id } });
          } else {
            const existingVariant = await db.Variant.findOne({ where: { id: variant_id, product_id: id } });
            if (existingVariant) {
              // Update the existing variant
              console.log(`Updating variant with ID: ${variant_id}`);
              await db.Variant.update(
                { colour, price, sale_price, stock, dimensions, materials, color_id, company_id, sku },
                { where: { id: variant_id } }
              );
            } else {
              return res.status(400).json({ error: `Variant with ID ${variant_id} not found for this product.` });
            }
          }
        } else {
          // Create a new variant if `variant_id` is not provided
          console.log(`Creating new variant for product ID: ${id}`);
          await db.Variant.create({
            product_id: id,
            colour,
            price,
            sale_price,
            stock,
            materials,
            deleted,
            dimensions,
            color_id,
            company_id,
            sku
          });
        }
      }
    }
    const productWithDealers = await fetchAfterUpdate(id);
    res.status(200).json({ message: 'Product and variants updated successfully.', productWithDealers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


const deleteProducts = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // 1. Delete Variants
    await db.Variant.destroy({ where: { product_id: id } });

    // 2. Delete Dealer Associations
    await db.ProductDealers.destroy({ where: { product_id: id } });

    // 3. Delete Product
    await db.Product.destroy({ where: { id } });

    const productWithDealers = [{id:parseInt(id)}]

    res.status(200).json({ message: 'Product deleted successfully', productWithDealers});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const filterProducts = async (req, res) => {
  try {
    const { limit = 100, offset = 0, orderBy, filters } = req.body;
    
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    const orderByCondition = orderBy?.length ? [[orderBy[0].colId, orderBy[0].sort]] : [["createdAt", "DESC"]];

    // Construct the where condition dynamically
    let whereCondition = {};

    if (filters) {
      if (filters.parent_id === null) {
        whereCondition.subcategory_id = filters.id || filters.category_id;
      } else if (filters.parent_id !== undefined) {
        whereCondition.subcategory_id = filters.parent_id;
      } else {
        whereCondition = { ...filters };
      }
    }

    // Fetch products with necessary associations
    const products = await db.Product.findAndCountAll({
      distinct: true,
      include: [
        {
          model: db.Variant,
          as: "variants",
          required: false,
          where: { deleted: 0 },
          attributes: ["id", "colour", "dimensions", "materials", "price", "sale_price", "colour","stock","color_id","company_id","sku"],
          include: [
            {
              model: db.materialsList,
              as: "materialDetail",
              attributes: ["id", "name"],
            },
          ],
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
          include: filters.id
            ? [
                {
                  model: db.Subcategory,
                  as: "subcategories",
                  where: { id: filters.id },
                  attributes: ["id", "name"],
                },
              ]
            : [], // Avoids filtering if parent_id is undefined
        },
      ],
      order: orderByCondition,
      where: whereCondition,
      limit: parsedLimit,
      offset: parsedOffset,
      col: "id",
    });

    // Process dealer information efficiently
    const productWithDealers = await Promise.all(
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


    res.json({
      products: {
        count: products.count,
        rows: productWithDealers,
        diamensionType: diamensionType,
        diamensionUnit: diamensionUnit
      },
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products", message: error.message });
  }
};

const filterUserProducts = async (req, res) => {
  // const { limit, offset, orderBy, filters } = req.body;
  // const orderByCondition = [[orderBy[0].colId, orderBy[0].sort]];
  // try {
  //   const products = await db.Product.findAll({
  //     attributes: ["id", "name", "company", "category_id", "subcategory_id", "updatedAt", "createdAt"],
  //     include: [
  //       {
  //         model: db.Variant,
  //         as: "variants",
  //         attributes: ["id", "product_id", "weight_id"],
  //         required: false,
  //         include: [{ model: db.Weight, as: "weight", attributes: ["weight", "unit"] }],
  //       },
  //       {
  //         model: db.Category,
  //         as: "category",
  //         attributes: ["id", "name"],
  //         required: false,
  //       },
  //     ],
  //     // order: [["updatedAt", "DESC"]], // Sort for faster retrieval
  //     order: ["product_id"],
  //     raw: true, // Fetch data as plain JSON (faster)
  //     nest: true, // Ensures nested JSON format
  //   });

  //   res.status(200).json({
  //     products: {
  //       message: "Products fetched successfully",
  //       count: products.length,
  //       rows: products,  
  //     }
  //   });
  // } catch (error) {
  //   console.error("Error fetching products:", error);
  //   res.status(500).json({ error: "Failed to fetch products" });
  // }

  const { limit, offset, orderBy, filters } = req.body;
    const orderByCondition = [[orderBy[0].colId, orderBy[0].sort]];
    const whereCondition = filters || {}; 
  try {
    // Step 1: Fetch all products with associations
    const products = await db.Product.findAll({
      distinct: true,  // Ensure distinct count of products
      include: [
        {
          model: db.Variant,
          as: 'variants',
          include: [
            { model: db.Color, as: 'color', attributes: ['name', 'hex_code'] },
            { model: db.Weight, as: 'weight', attributes: ['weight','unit'] },
          ],
        },
      ],
      order: orderByCondition, // Apply the ordering condition
      where: whereCondition, // Apply the filters (or no filter if filters is null)
      distinct: true,  // Add this to fix duplicate count issue
      col: 'id', // Ensures distinct is applied correctly on primary key
    });
    
    res.json({ products: {
        count: 0,
        rows: products
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products', mess: error });
  }
};

const fetchSingleProduct = async (req, res) => {
  const { productId } = req.body; // Ensure this is inside an Express route

  if (!productId) {
    return res.status(400).json({ error: "Product ID is required" });
  }

  try {
    const products = await db.Variant.findAll({
        where: { product_id: productId }, // Query variants for a given product
    });

    res.json(products);
  } catch (error) {
    console.error("Error fetching product variants:", error);
    res.status(500).json({ error: "Failed to fetch product variants" });
  }
};



module.exports = {
  createProducts,
  getAllProducts,
  updateProducts,
  deleteProducts,
  filterProducts,
  filterUserProducts,
  fetchSingleProduct
};
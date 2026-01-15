// controllers/productsController.js
const db = require("../models");
const { Product, Dealer, Category, Color, Weight, Variant } = require("../models");
const { Op, where, Sequelize } = require('sequelize');
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
        const { price, sale_price, stock, deleted, materials, colour, dimensions, sku, color_id, company_id, size, title, displayTitle } = variant;
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
          company_id,
		  size,
		  title,
      displayTitle
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
          attributes: ["id", "colour", "dimensions", "materials", "sale_price", "color_id","stock","company_id","sku", "size", "title", "displayTitle"]
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

// const getAllProducts = async (req, res) => {
//   const { limit, offset, orderBy, filters } = req.body;
//   const parsedLimit = limit ? parseInt(limit, 10) : 10;
//     const parsedOffset = offset ? parseInt(offset, 10) : 0;
//     // const orderByCondition = [['createdAt', 'DESC']];
//     const orderByCondition = [[orderBy[0].colId, orderBy[0].sort]];
//     const whereCondition = filters || {}; 
//   try {
//     // Step 1: Fetch all products with associations
//     const products = await db.Product.findAndCountAll({
//       distinct: true,  // Ensure distinct count of products
//       include: [
//         {
//           model: db.ProductImage,
//           as: 'imagesT',
//           attributes: ['id', 'image_url', 'public_id', 'product_id'],
//         },
//         {
//           model: db.Category,
//           as: 'category',
//           attributes: ['id', 'name'],
//           include: [
//             {
//               model: db.Subcategory,
//               as: 'subcategories',
//               attributes: ['id', 'name','parent_id'],
//             },
//           ]
//         },
        
//       ],
//       order: orderByCondition, // Apply the ordering condition
//       where: whereCondition, // Apply the filters (or no filter if filters is null)
//       limit: parsedLimit, // Apply pagination limit
//       offset: parsedOffset, // Apply pagination offset
//       distinct: true,  // Add this to fix duplicate count issue
//       col: 'id' // Ensures distinct is applied correctly on primary key
//     });
    
//     // Post-process each product to fetch dealers based on dealer_id string
//     const productWithDealers = await Promise.all(
//       products.rows.map(async (product) => {
//         const dealerIds = product.dealer_id.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id)); // Parse dealer_id string
//         const dealers = await db.Dealer.findAll({
//           where: {
//             id: {
//               [Op.in]: dealerIds, // Fetch all dealers with parsed IDs
//             },
//           },
//           attributes: ['id', 'name', 'company', 'email', 'mobile_number', 'dealer_status'],
//         });
//         return { ...product.toJSON(), dealers }; // Add dealers to product
//       })
//     );
// console.log(productWithDealers, 'hiiii')
//     res.json({ products: {
//         count: products.count,
//         rows: productWithDealers
//       }
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch products' });
//   }
// };

const getAllProducts = async (req, res) => {
  const { limit, offset, orderBy, filters } = req.body;

  const parsedLimit = limit ? parseInt(limit, 10) : 10;
  const parsedOffset = offset ? parseInt(offset, 10) : 0;

  const orderByCondition = orderBy?.length
    ? [[orderBy[0].colId, orderBy[0].sort]]
    : [['id', 'DESC']];

  try {
    const products = await db.Product.findAndCountAll({
      distinct: true,
      where: filters || {},
      limit: parsedLimit,
      offset: parsedOffset,
      order: orderByCondition,

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
              attributes: ['id', 'name', 'parent_id'],
            }
          ]
        }
      ]
    });

    res.json({
      products: {
        count: products.count,
        rows: products.rows
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
        const { variant_id, price, sale_price, stock, deleted, materials, dimensions, colour, color_id, company_id, sku, size, title, displayTitle } = variant;

        // Check if the variant exists
        if (variant_id) {
          if (deleted === true) {
            //console.log(`Deleting variant with ID: ${variant_id}`);
            await db.Variant.destroy({ where: { id: variant_id } });
          } else {
            const existingVariant = await db.Variant.findOne({ where: { id: variant_id, product_id: id } });
            if (existingVariant) {
              // Update the existing variant
              //console.log(`Updating variant with ID: ${variant_id}`);
              await db.Variant.update(
                { colour, price, sale_price, stock, dimensions, materials, color_id, company_id, sku, size, title, displayTitle },
                { where: { id: variant_id } }
              );
            } else {
              return res.status(400).json({ error: `Variant with ID ${variant_id} not found for this product.` });
            }
          }
        } else {
          // Create a new variant if `variant_id` is not provided
          //console.log(`Creating new variant for product ID: ${id}`);
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
            sku,
			size,
			title,
      displayTitle
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
          attributes: ["id", "colour", "dimensions", "materials", "price", "sale_price", "colour","stock","color_id","company_id","sku","size","title","displayTitle"],
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

const filterProductsNew2026 = async (req, res) => {
  try {
    const { limit = 100, offset = 0, orderBy, filters } = req.body;

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    const orderByCondition = orderBy?.length
      ? [[orderBy[0].colId, orderBy[0].sort]]
      : [["createdAt", "DESC"]];

    // Construct the where condition dynamically
    let whereCondition = {};

    if (filters) {
      if (filters.parent_id === null) {
        whereCondition.subcategory_id = filters.id || filters.category_id || filters.subcategory_id;
      } else if (filters.parent_id !== undefined) {
        whereCondition.subcategory_id = filters.parent_id;
      } else {
        whereCondition = { ...filters };
      }
    }
    console.log(whereCondition);
    
    // Fetch variants (added product_id)
    const variants = await db.Variant.findAndCountAll({
      attributes: [
        "id",
        "product_id", // ✅ added
        "price",
        "sale_price",
        "stock",
        "sku",
        "size",
        "title",
        "displayTitle"
      ],
      limit: parsedLimit,
      offset: parsedOffset,
      col: "id",      
    });

    // Get variant IDs
    const variantIds = variants.rows.map(v => v.id);

    let imagesMap = new Map();

    if (variantIds.length > 0) {
      const productImages = await db.ProductImage.findAll({
        where: {
          product_id: { [Op.in]: variantIds },
        },
        attributes: ["id", "product_id", "image_id"],
      });

      const imageIds = productImages.map(pi => pi.image_id).filter(Boolean);

      if (imageIds.length > 0) {
        const images = await db.Image.findAll({
          where: {
            id: { [Op.in]: imageIds },
          },
          attributes: ["id", "image_url", "public_id"],
        });

        const imageDataMap = new Map(
          images.map(img => [img.id, img.toJSON()])
        );

        productImages.forEach(pi => {
          const imageData = imageDataMap.get(pi.image_id);
          if (imageData) {
            if (!imagesMap.has(pi.product_id)) {
              imagesMap.set(pi.product_id, []);
            }
            imagesMap.get(pi.product_id).push({
              id: pi.id,
              product_id: pi.product_id,
              image_id: pi.image_id,
              ...imageData,
            });
          }
        });
      }
    }

    // 🔹 Fetch product names
    const productIds = [
      ...new Set(
        variants.rows.map(v => v.product_id).filter(Boolean)
      ),
    ];

    let productNameMap = new Map();

    if (productIds.length > 0) {
      const products = await db.Product.findAll({
        where: { id: { [Op.in]: productIds } },
        attributes: ["id", "name"],
      });

      productNameMap = new Map(
        products.map(p => [p.id, p.name])
      );
    }

    // Process variants with images + product name
    const processedVariants = variants.rows.map(variant => {
      const variantData = variant.toJSON();
      const images = imagesMap.get(variantData.id) || [];

      return {
        ...variantData,
        title: JSON.parse(variantData.title),
        product_name: productNameMap.get(variantData.product_id) || null, // ✅
        images,
        primary_image: images.length > 0 ? images[0] : null,
      };
    });

    res.json({
      variants: {
        count: variants.count,
        rows: processedVariants,
      },
    });
  } catch (error) {
    console.error("Error fetching variants:", error);
    res.status(500).json({
      error: "Failed to fetch variants",
      message: error.message,
    });
  }
};

const filterProductsNew = async (req, res) => {
  try {
    const { limit = 100, offset = 0, orderBy, filters } = req.body;

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    // Default ordering logic with fallback to Product's createdAt
    const orderByCondition = orderBy?.length
      ? [
          [
            orderBy[0]?.colId === 'price' ? 'price' : orderBy[0]?.colId,
            orderBy[0]?.sort || 'ASC',
          ],
        ]
      : [['price', 'ASC']]; // Default sorting by Product's createdAt

    // Construct dynamic filters for the product table
    let whereCondition = {};

    if (filters) {
      if (filters.parent_id === null) {
        whereCondition.subcategory_id = filters.id || filters.category_id || filters.subcategory_id;
      } else if (filters.parent_id !== undefined) {
        whereCondition.subcategory_id = filters.parent_id;
      } else {
        whereCondition = { ...filters };
      }
    }

    //console.log(orderByCondition); // Debugging filters

    // Fetch variants with product details and images in a single query
    const variants = await db.Variant.findAndCountAll({
      attributes: ['id', 'product_id', 'price', 'sale_price', 'stock', 'sku', 'size', 'title', 'displayTitle'],
      limit: parsedLimit,
      offset: parsedOffset,
      include: [
        {
          model: db.Product,
          as: 'product', // Alias for Product association
          attributes: ['id', 'name', 'category_id', 'gst_rate', 'subcategory_id', 'createdAt'], // Include only necessary fields
          where: whereCondition, // Apply the filters
        },
        {
          model: db.ProductImage,
          as: 'productImages', // Alias for ProductImage association
          attributes: ['id', 'image_id'],
          include: {
            model: db.Image,
            attributes: ['id', 'image_url', 'public_id'], // Only include necessary image fields
          },
        },
      ],
      order: orderByCondition, // Apply the dynamic ordering
    });

    // Process variants and format data efficiently
    const processedVariants = variants.rows.map(variant => {
      const variantData = variant.toJSON();
      const product = variantData.product || {};
      const images = variantData.productImages || [];
      const productImages = images.map(image => image.Image).filter(Boolean); // Extract image data

      return {
        ...variantData,
        // title: JSON.parse(variantData.title), // Assuming `title` is a JSON object
        title: variantData.title,
        product_name: product.name || null,
        images: productImages, // Return images for the variant
        primary_image: productImages.length > 0 ? productImages[0] : null, // First image as primary
      };
    });

    res.json({
      variants: {
        count: variants.count,
        rows: processedVariants,
      },
    });
  } catch (error) {
    console.error("Error fetching variants:", error);
    res.status(500).json({
      error: 'Failed to fetch variants',
      message: error.message,
    });
  }
};

const searchProducts = async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      orderBy,
      filters = {},
    } = req.body;

    const searchTerm = filters.searchTerm?.trim();
    const selectedBrand = filters.searchBrandTerm; // company_id

    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);

    const orderByCondition = orderBy?.length
      ? [[orderBy[0].colId === 'price' ? 'price' : orderBy[0].colId, orderBy[0].sort || 'ASC']]
      : [['price', 'ASC']];

    /** -----------------------------
     * Variant WHERE conditions
     ------------------------------*/
    const variantWhere = {};

    // ✅ Brand filter on Variant
    if (selectedBrand) {
      variantWhere.company_id = selectedBrand;
    }

    // ✅ Search conditions
    if (searchTerm) {
  variantWhere[Op.and] = [{
    [Op.or]: [
      { displayTitle: { [Op.like]: `%${searchTerm}%` } },
      { sku: { [Op.like]: `%${searchTerm}%` } },
      { size: { [Op.like]: `%${searchTerm}%` } },

      // ✅ SAFE JSON search
      Sequelize.and(
        Sequelize.where(
          Sequelize.fn('JSON_VALID', Sequelize.col('Variant.title')),
          1
        ),
        Sequelize.where(
          Sequelize.fn(
            'JSON_SEARCH',
            Sequelize.col('Variant.title'),
            'one',
            searchTerm
          ),
          { [Op.ne]: null }
        )
      ),

      // product name search
      Sequelize.where(
        Sequelize.col('product.name'),
        { [Op.like]: `%${searchTerm}%` }
      ),
    ],
  }];
}


    const variants = await db.Variant.findAndCountAll({
      attributes: [
        'id',
        'product_id',
        'company_id',
        'price',
        'sale_price',
        'stock',
        'sku',
        'size',
        'title',
        'displayTitle',
      ],
      where: variantWhere,
      limit: parsedLimit,
      offset: parsedOffset,
      order: orderByCondition,
      distinct: true,
      include: [
        {
          model: db.Product,
          as: 'product',
          attributes: ['id', 'name', 'gst_rate', 'category_id', 'subcategory_id', 'createdAt'],
          required: true, // safe even without search
        },
        {
          model: db.ProductImage,
          as: 'productImages',
          attributes: ['id', 'image_id'],
          include: {
            model: db.Image,
            attributes: ['id', 'image_url', 'public_id'],
          },
        },
      ],
    });

    const processedVariants = variants.rows.map(v => {
      const data = v.toJSON();
      let parsedTitle = {};

      try {
        parsedTitle = typeof data.title === 'string'
          ? JSON.parse(data.title)
          : data.title;
      } catch {
        parsedTitle = {};
      }

      const images = data.productImages || [];
      const productImages = images.map(i => i.Image).filter(Boolean);

      return {
        ...data,
        title: parsedTitle,
        product_name: data.product?.name || null,
        images: productImages,
        primary_image: productImages[0] || null,
        product: data.product, // 👈 full product object
      };
    });

    res.json({
      variants: {
        count: variants.count,
        rows: processedVariants,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Failed to search variants',
      message: error.message,
    });
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
  fetchSingleProduct,
  filterProductsNew,
  searchProducts
};
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
      dealer_id = '',
      category_id = 0,
      subcategory_id = 0,
      company,
      discription,
      variants = [],
      subcategory_ids = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    /* 1️⃣ Create product (NO category/subcategory here) */
    const product = await db.Product.create({
      name,
      stock,
      gst_rate,
      price,
      sale_price,
      company,
      dealer_id,
      category_id,
      subcategory_id,
      discription,
    });

    const productId = product.id;

    /* 2️⃣ Map product → subcategories */
    if (subcategory_ids.length > 0) {
      const mappings = subcategory_ids.map((subId) => ({
        product_id: productId,
        subcategory_id: subId,
      }));

      await db.ProductSubcategoryMap.bulkCreate(mappings);
    }

    /* 3️⃣ Dealer mapping */
    if (dealer_id?.length > 0) {
      const dealerMappings = dealer_id.map((dealerId) => ({
        product_id: productId,
        dealer_id: dealerId,
      }));

      await db.ProductDealers.bulkCreate(dealerMappings);
    }

    /* 4️⃣ Variants */
    if (variants.length > 0) {
      await Promise.all(
        variants.map((variant) =>
          db.Variant.create({
            product_id: productId,
            colour: variant.colour,
            price: variant.price,
            sale_price: variant.sale_price,
            stock: variant.stock,
            materials: variant.materials,
            deleted: variant.deleted,
            dimensions: variant.dimensions,
            sku: variant.sku,
            color_id: variant.color_id,
            company_id: variant.company_id,
            size: variant.size,
            title: variant.title,
            displayTitle: variant.displayTitle,
          })
        )
      );
    }

    const productWithDealers = await fetchAfterUpdate(productId);

    return res.status(201).json({
      message: 'Product created successfully',
      productWithDealers,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
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

        /* 🔑 Product → Subcategory (M:N) */
        {
          model: db.Subcategory,
          through: { attributes: [] }, // hide mapping table
          attributes: ['id', 'name', 'parent_id'],

          include: [
            {
              model: db.Category,
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    res.json({
      products: {
        count: products.count,
        rows: products.rows,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

const updateProducts = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      id,
      name,
      stock,
      gst_rate,
      price,
      sale_price,
      company,
      discription,
      variants = [],
      subcategory_ids = [],
      dealer_id = [],
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Product ID is required for updating.' });
    }

    /* 1️⃣ Update product (NO category / subcategory here) */
    const [updatedRows] = await db.Product.update(
      { name, stock, gst_rate, price, sale_price, company, discription },
      { where: { id }, transaction }
    );

    if (!updatedRows) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Product not found.' });
    }

    /* 2️⃣ Sync Subcategories (DELETE + INSERT) */
    await db.ProductSubcategoryMap.destroy({
      where: { product_id: id },
      transaction,
    });

    if (subcategory_ids.length > 0) {
      const subcategoryMappings = subcategory_ids.map((subId) => ({
        product_id: id,
        subcategory_id: subId,
      }));

      await db.ProductSubcategoryMap.bulkCreate(subcategoryMappings, {
        transaction,
      });
    }

    /* 3️⃣ Sync Dealers */
    await db.ProductDealers.destroy({
      where: { product_id: id },
      transaction,
    });

    if (dealer_id.length > 0) {
      const dealerMappings = dealer_id.map((dealerId) => ({
        product_id: id,
        dealer_id: dealerId,
      }));

      await db.ProductDealers.bulkCreate(dealerMappings, {
        transaction,
      });
    }

    /* 4️⃣ Handle Variants */
    for (const variant of variants) {
      const {
        variant_id,
        price,
        sale_price,
        stock,
        deleted,
        materials,
        dimensions,
        colour,
        color_id,
        company_id,
        sku,
        size,
        title,
        displayTitle,
      } = variant;

      if (variant_id) {
        if (deleted === true) {
          await db.Variant.destroy({
            where: { id: variant_id, product_id: id },
            transaction,
          });
        } else {
          await db.Variant.update(
            {
              colour,
              price,
              sale_price,
              stock,
              dimensions,
              materials,
              color_id,
              company_id,
              sku,
              size,
              title,
              displayTitle,
            },
            { where: { id: variant_id, product_id: id }, transaction }
          );
        }
      } else {
        await db.Variant.create(
          {
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
            displayTitle,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    const productWithDealers = await fetchAfterUpdate(id);

    return res.status(200).json({
      message: 'Product updated successfully.',
      productWithDealers,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

const deleteProducts = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    /* 1️⃣ Delete product (CASCADE will handle everything else) */
    const deleted = await db.Product.destroy({
      where: { id },
      transaction,
    });

    if (!deleted) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }

    await transaction.commit();

    res.status(200).json({
      message: 'Product deleted successfully',
      productWithDealers: [{ id: Number(id) }],
    });
  } catch (error) {
    await transaction.rollback();
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

// const filterProductsNew = async (req, res) => {
//   try {
//     const { limit = 100, offset = 0, orderBy, filters } = req.body;

//     const parsedLimit = parseInt(limit, 10);
//     const parsedOffset = parseInt(offset, 10);

//     // Default ordering logic with fallback to Product's createdAt
//     const orderByCondition = orderBy?.length
//       ? [
//           [
//             orderBy[0]?.colId === 'price' ? 'price' : orderBy[0]?.colId,
//             orderBy[0]?.sort || 'ASC',
//           ],
//         ]
//       : [['price', 'ASC']]; // Default sorting by Product's createdAt

//     // Construct dynamic filters for the product table
//     let whereCondition = {};

//     if (filters) {
//       if (filters.parent_id === null) {
//         whereCondition.subcategory_id = filters.id || filters.category_id || filters.subcategory_id;
//       } else if (filters.parent_id !== undefined) {
//         whereCondition.subcategory_id = filters.parent_id;
//       } else {
//         whereCondition = { ...filters };
//       }
//     }

//     //console.log(orderByCondition); // Debugging filters

//     // Fetch variants with product details and images in a single query
//     const variants = await db.Variant.findAndCountAll({
//       attributes: ['id', 'product_id', 'price', 'sale_price', 'stock', 'sku', 'size', 'title', 'displayTitle'],
//       limit: parsedLimit,
//       offset: parsedOffset,
//       include: [
//         {
//           model: db.Product,
//           as: 'product', // Alias for Product association
//           attributes: ['id', 'name', 'category_id', 'gst_rate', 'subcategory_id', 'createdAt'], // Include only necessary fields
//           where: whereCondition, // Apply the filters
//         },
//         {
//           model: db.ProductImage,
//           as: 'productImages', // Alias for ProductImage association
//           attributes: ['id', 'image_id'],
//           include: {
//             model: db.Image,
//             attributes: ['id', 'image_url', 'public_id'], // Only include necessary image fields
//           },
//         },
//       ],
//       order: orderByCondition, // Apply the dynamic ordering
//     });

//     // Process variants and format data efficiently
//     const processedVariants = variants.rows.map(variant => {
//       const variantData = variant.toJSON();
//       const product = variantData.product || {};
//       const images = variantData.productImages || [];
//       const productImages = images.map(image => image.Image).filter(Boolean); // Extract image data

//       return {
//         ...variantData,
//         // title: JSON.parse(variantData.title), // Assuming `title` is a JSON object
//         title: variantData.title,
//         product_name: product.name || null,
//         images: productImages, // Return images for the variant
//         primary_image: productImages.length > 0 ? productImages[0] : null, // First image as primary
//       };
//     });

//     res.json({
//       variants: {
//         count: variants.count,
//         rows: processedVariants,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching variants:", error);
//     res.status(500).json({
//       error: 'Failed to fetch variants',
//       message: error.message,
//     });
//   }
// };

const filterProductsNew = async (req, res) => {
  try {
    const { limit = 100, offset = 0, orderBy, filters } = req.body;

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    const orderByCondition = orderBy?.length
      ? [[orderBy[0].colId === 'price' ? 'price' : orderBy[0].colId, orderBy[0].sort || 'ASC']]
      : [['price', 'ASC']];

    let productWhere = {};
    if (filters?.category_id) {
      productWhere.category_id = filters.category_id;
    }

    let subcategoryWhere = {};
    if (filters?.subcategory_id || filters?.parent_id) {
      subcategoryWhere.id = filters.subcategory_id || filters.parent_id;
    }

    const variants = await db.Variant.findAndCountAll({
      attributes: [
        'id',
        'product_id',
        'price',
        'sale_price',
        'stock',
        'sku',
        'size',
        'title',
        'displayTitle',
      ],
      limit: parsedLimit,
      offset: parsedOffset,
      distinct: true,
      include: [
        {
          model: db.Product,
          as: 'product',
          attributes: ['id', 'name', 'category_id', 'gst_rate', 'createdAt'],
          where: productWhere,
          include: [
            {
              model: db.Subcategory,
              as: 'subcategories',
              attributes: ['id', 'name'],
              through: { attributes: [] },
              where: Object.keys(subcategoryWhere).length ? subcategoryWhere : undefined,
              required: true,
            },
          ],
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
      order: orderByCondition,
    });

    const processedVariants = variants.rows.map((variant) => {
      const v = variant.toJSON();
      const product = v.product || {};
      const images = v.productImages || [];
      const productImages = images.map((img) => img.Image).filter(Boolean);

      return {
        ...v,
        product_name: product.name || null,
        images: productImages,
        primary_image: productImages[0] || null,
      };
    });

    res.json({
      variants: {
        count: variants.count,
        rows: processedVariants,
      },
    });
  } catch (error) {
    console.error('Error fetching variants:', error);
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
  const words = searchTerm.split(/\s+/).filter(Boolean);

  const orConditions = words.map(word => ({
    [Op.or]: [
      { displayTitle: { [Op.like]: `%${word}%` } },
      { sku: { [Op.like]: `%${word}%` } },
      { size: { [Op.like]: `%${word}%` } },
      Sequelize.and(
        Sequelize.where(
          Sequelize.fn('JSON_VALID', Sequelize.col('Variant.title')),
          1
        ),
        Sequelize.where(
          Sequelize.fn('JSON_SEARCH', Sequelize.col('Variant.title'), 'one', word),
          { [Op.ne]: null }
        )
      ),
      Sequelize.where(
        Sequelize.col('product.name'),
        { [Op.like]: `%${word}%` }
      ),
      // ✅ New: search inside brand name if brand is selected
      selectedBrand
        ? Sequelize.where(
            Sequelize.col('company_id'), // replace with your Brand name column in Product table
            { [Op.like]: `%${word}%` }
          )
        : null,
    ].filter(Boolean) // remove null if brand not selected
  }));

  // Combine all words with AND (all words must appear somewhere)
  variantWhere[Op.and] = orConditions;
}
const variants = await db.Variant.findAndCountAll({
  attributes: [
    'id', 'product_id', 'company_id', 'price', 'sale_price', 'stock',
    'sku', 'size', 'title', 'displayTitle',
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
      required: true,
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

// Check if search returned zero rows
let isFallback = false;
let processedVariants = [];

if (variants.count === 0) {
  isFallback = true;

  // Return default set (e.g., first 20 variants by price ASC)
  const defaultVariants = await db.Variant.findAll({
    attributes: [
      'id', 'product_id', 'company_id', 'price', 'sale_price', 'stock',
      'sku', 'size', 'title', 'displayTitle',
    ],
    limit: parsedLimit,
    offset: parsedOffset,
    order: [['price', 'ASC']],
    include: [
      { model: db.Product, as: 'product', attributes: ['id', 'name'] },
      {
        model: db.ProductImage,
        as: 'productImages',
        attributes: ['id', 'image_id'],
        include: { model: db.Image, attributes: ['id', 'image_url', 'public_id'] },
      },
    ],
  });

  processedVariants = defaultVariants.map(v => {
    const data = v.toJSON();
    const images = data.productImages || [];
    const productImages = images.map(i => i.Image).filter(Boolean);

    let parsedTitle = {};
    try {
      parsedTitle = typeof data.title === 'string' ? JSON.parse(data.title) : data.title;
    } catch {
      parsedTitle = {};
    }

    return {
      ...data,
      title: parsedTitle,
      product_name: data.product?.name || null,
      images: productImages,
      primary_image: productImages[0] || null,
      product: data.product,
    };
  });

} else {
  // Normal search results
  processedVariants = variants.rows.map(v => {
    const data = v.toJSON();
    const images = data.productImages || [];
    const productImages = images.map(i => i.Image).filter(Boolean);

    let parsedTitle = {};
    try {
      parsedTitle = typeof data.title === 'string' ? JSON.parse(data.title) : data.title;
    } catch {
      parsedTitle = {};
    }

    return {
      ...data,
      title: parsedTitle,
      product_name: data.product?.name || null,
      images: productImages,
      primary_image: productImages[0] || null,
      product: data.product,
    };
  });
}

res.json({
  variants: {
    count: processedVariants.length,
    rows: processedVariants,
  },
  searchEmpty: isFallback, // 👈 flag if search returned zero results
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
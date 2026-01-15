const { Sequelize, DataTypes } = require('sequelize');  // <-- Ensure Sequelize is imported here
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASSWORD,
//   {
//     host: process.env.DB_HOST,
//     dialect: 'mysql',
//     logging: false, 
//   }
// );

// below code for TiDB
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    dialectModule: require('mysql2'),
	logging: false,
    logging: (sql, timing) => {
    console.log(`[SQL] ${new Date().toISOString()} - ${sql} - Duration: ${timing} ms`);
  },
  benchmark: true, // ⬅️ enables timing info
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true,
         //If TiDB requires a CA file, uncomment below:
        ca: process.env.DB_SSL_CA
      },
    },
  }
);

const db = {};
db.Sequelize = Sequelize;  // <-- Attach Sequelize to the db object
db.sequelize = sequelize;


// Import models here
db.Admin = require('./admin')(sequelize, DataTypes);
db.User = require('./user')(sequelize, DataTypes);
db.Category = require('./category')(sequelize, DataTypes);
db.Subcategory = require('./subcategory')(sequelize, DataTypes);
db.Product = require('./product')(sequelize, DataTypes);
db.Dealer = require('./dealer')(sequelize, DataTypes);
db.Order = require('./order')(sequelize, DataTypes);
db.OrderItem = require('./orderItem')(sequelize, DataTypes);
db.ProductDealers = require('./productDealer')(sequelize, DataTypes);
db.Color = require('./color')(sequelize, DataTypes);
db.Weight = require('./weight')(sequelize, DataTypes);
db.Variant = require('./variant')(sequelize, DataTypes);
db.ProductImage = require('./productImages')(sequelize, DataTypes);
db.OrderImage = require('./orderImages')(sequelize, DataTypes);
db.Setting = require('./setting')(sequelize, DataTypes);
db.Comments = require('./comment')(sequelize, DataTypes);
db.productNew = require('./productNew')(sequelize, DataTypes);
db.productAttribute = require('./productAttribute')(sequelize, DataTypes);
db.companyNew = require('./companyNew')(sequelize, DataTypes);
db.materialsList = require('./materials_list')(sequelize, DataTypes);
db.dimensionType = require('./dimension_type')(sequelize, DataTypes);
db.dimensionUnit = require('./dimension_unit')(sequelize, DataTypes);
db.Image = require('./image')(sequelize, DataTypes);
db.Orderwebsite = require('./Order_website')(sequelize, DataTypes);
db.OrderWebsiteItems = require('./order_websiteitems')(sequelize, DataTypes);
// Define relationships


// /* =========================
//    USER ↔ ORDER (Website)
// ========================= */

// db.Orderwebsite.belongsTo(db.User, {
//   foreignKey: 'user_id',
//   as: 'user',
// });

// db.User.hasMany(db.Orderwebsite, {
//   foreignKey: 'user_id',
//   as: 'orders',
// });


// /* =========================
//    ORDER ↔ ORDER ITEMS
// ========================= */

// db.Orderwebsite.hasMany(db.OrderWebsiteItems, {
//   foreignKey: 'order_id',
//   as: 'orderItems',
// });

// db.OrderWebsiteItems.belongsTo(db.Orderwebsite, {
//   foreignKey: 'order_id',
// });


// /* =========================
//    ORDER ITEM ↔ VARIANT
// ========================= */

// db.OrderWebsiteItems.belongsTo(db.Variant, {
//   foreignKey: 'variant_id',
//   as: 'variant',
// });

// db.Variant.hasMany(db.OrderWebsiteItems, {
//   foreignKey: 'variant_id',
//   as: 'orderItems',
// });


// /* =========================
//    VARIANT ↔ PRODUCT
// ========================= */

// db.Variant.belongsTo(db.Product, {
//   foreignKey: 'product_id',
//   as: 'product',
// });

// db.Product.hasMany(db.Variant, {
//   foreignKey: 'product_id',
//   as: 'variants',
// });


// /* =========================
//    PRODUCT ↔ PRODUCT IMAGE
// ========================= */

// db.Product.hasMany(db.ProductImage, {
//   foreignKey: 'product_id',
//   as: 'productImages',
//   onDelete: 'CASCADE',
// });

// db.ProductImage.belongsTo(db.Product, {
//   foreignKey: 'product_id',
//   as: 'product',
// });


// /* =========================
//    IMAGE ↔ PRODUCT IMAGE
// ========================= */

// db.Image.hasMany(db.ProductImage, {
//   foreignKey: 'image_id',
// });

// db.ProductImage.belongsTo(db.Image, {
//   foreignKey: 'image_id',
// });


// /* =========================
//    CATEGORY ↔ SUBCATEGORY
// ========================= */

// db.Category.hasMany(db.Subcategory, {
//   foreignKey: 'category_id',
//   as: 'subcategories',
// });

// db.Subcategory.belongsTo(db.Category, {
//   foreignKey: 'category_id',
//   as: 'category',
// });

// // Self-referencing subcategory
// db.Subcategory.hasMany(db.Subcategory, {
//   foreignKey: 'parent_id',
//   as: 'children',
// });

// db.Subcategory.belongsTo(db.Subcategory, {
//   foreignKey: 'parent_id',
//   as: 'parent',
// });


// /* =========================
//    MATERIAL ↔ VARIANT
// ========================= */

// db.Variant.belongsTo(db.materialsList, {
//   foreignKey: 'materials',
//   targetKey: 'id',
//   as: 'materialDetail',
// });

// db.materialsList.hasMany(db.Variant, {
//   foreignKey: 'materials',
//   sourceKey: 'id',
//   as: 'variants',
// });


// /* =========================
//    DEALER ↔ PRODUCT (M:N)
// ========================= */

// db.Product.belongsToMany(db.Dealer, {
//   through: 'product_dealers',
//   foreignKey: 'product_id',
//   otherKey: 'dealer_id',
//   as: 'dealers',
// });

// db.Dealer.belongsToMany(db.Product, {
//   through: 'product_dealers',
//   foreignKey: 'dealer_id',
//   otherKey: 'product_id',
//   as: 'products',
// });




// ------- old one 25-1-20206 ----------------------------------

// OrderWebsiteItems belongs to Variant
db.OrderWebsiteItems.belongsTo(db.Variant, {
  foreignKey: 'variant_id', // This is the column in OrderWebsiteItems
  as: 'variantOrder'
});

// OrderWebsite has many OrderWebsiteItems
db.Orderwebsite.hasMany(db.OrderWebsiteItems, {
  foreignKey: 'order_id', // This is the column in OrderWebsiteItems
  as: 'orderItemsReferral'
});

db.Orderwebsite.hasMany(db.OrderWebsiteItems, {
  foreignKey: 'order_id',
  as: 'orderList', // THIS MUST MATCH
});
db.OrderWebsiteItems.belongsTo(db.Orderwebsite, {
  foreignKey: 'order_id',
});

db.Orderwebsite.hasMany(db.OrderWebsiteItems, {
  foreignKey: 'order_id',  // OrderWebsiteItems.order_id -> Orderwebsite.id
  as: 'orderItems',
});

db.OrderWebsiteItems.belongsTo(db.Orderwebsite, {
  foreignKey: 'order_id',
});

db.Orderwebsite.belongsTo(db.User, {
  foreignKey: 'user_id',
  as: 'user',
});
db.User.hasMany(db.Orderwebsite, {
  foreignKey: 'user_id',
  as: 'orderwebsite',
});

// ---------------------------------------

db.Product.belongsTo(db.Category, { foreignKey: 'category_id', as: 'category' });
db.Category.hasMany(db.Product, { foreignKey: 'category_id', as: 'products' });

db.Product.hasMany(db.Variant, { foreignKey: 'product_id', as: 'variants' });
db.Variant.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });


// In the Product model:
db.Product.belongsToMany(db.Dealer, {
  through: 'product_dealers',
  foreignKey: 'product_id',  // The column in the join table representing Product
  otherKey: 'dealer_id',     // The column in the join table representing Dealer
  as: 'dealers'
});


// In the Dealer model:
db.Dealer.belongsToMany(db.Product, {
  through: 'product_dealers',
  foreignKey: 'dealer_id',   // The column in the join table representing Dealer
  otherKey: 'product_id',    // The column in the join table representing Product
  as: 'products'
});




db.Order.belongsTo(db.User, { foreignKey: "user_id" });
db.Order.hasMany(db.OrderItem, { foreignKey: "order_id" });

db.OrderItem.belongsTo(db.Order, { foreignKey: "order_id" });
db.OrderItem.belongsTo(db.Product, { foreignKey: "product_id" });

db.ProductImage.belongsTo(db.Product, { foreignKey: 'product_id', as: 'productT'});
db.Product.hasMany(db.ProductImage, { foreignKey: 'product_id', as: 'imagesT', onDelete: 'CASCADE',});

db.OrderImage.belongsTo(db.Order, { foreignKey: 'order_id', as: 'order' });
db.Order.hasMany(db.OrderImage, { foreignKey: 'order_id', as: 'images', onDelete: 'CASCADE' });

db.Order.hasMany(db.Comments, { foreignKey: 'order_id', onDelete: 'CASCADE' });
db.Comments.belongsTo(db.Order, { foreignKey: 'order_id' });

db.companyNew.hasMany(db.productNew, { foreignKey: "company_id" });
db.productNew.belongsTo(db.companyNew, { foreignKey: "company_id" });

db.companyNew.hasMany(db.productAttribute, { foreignKey: "product_id" });
db.productAttribute.belongsTo(db.companyNew, { foreignKey: "product_id" });

db.productNew.hasMany(db.productAttribute, { foreignKey: "product_id" });
db.productAttribute.belongsTo(db.productNew, { foreignKey: "product_id" });

db.Category.hasMany(db.Subcategory, { foreignKey: "category_id", as: "subcategories" });
db.Subcategory.belongsTo(db.Category, { foreignKey: "category_id", as: "Category" });

db.Subcategory.hasMany(db.Subcategory, { foreignKey: "parent_id", as: "subcategories" }); // Self-referencing
db.Subcategory.belongsTo(db.Subcategory, { foreignKey: "parent_id", as: "parent" }); // Self-referencing
db.Variant.belongsTo(db.materialsList, {
  foreignKey: 'materials',
  targetKey: 'id',
  as: 'materialDetail',
});

db.materialsList.hasMany(db.Variant, {
  foreignKey: 'materials',
  sourceKey: 'id',
  as: 'variants',
});


// Image ↔ ProductImage
db.Image.hasMany(db.ProductImage, {
  foreignKey: 'image_id',
});
db.ProductImage.belongsTo(db.Image, {
  foreignKey: 'image_id',
});

// Image ↔ OrderImage
db.Image.hasMany(db.OrderImage, {
  foreignKey: 'image_id',
});
db.OrderImage.belongsTo(db.Image, {
  foreignKey: 'image_id',
});

// Variant model
db.Variant.belongsTo(db.Product, { as: 'productfilter', foreignKey: 'product_id' });
db.Variant.hasMany(db.ProductImage, { foreignKey: 'product_id', as: 'productImages' });

// ProductImage model
db.ProductImage.belongsTo(db.Variant, { foreignKey: 'product_id' }); // ProductImage belongs to Variant
db.ProductImage.belongsTo(db.Image, { foreignKey: 'image_id' }); // ProductImage belongs to Image


module.exports = db;
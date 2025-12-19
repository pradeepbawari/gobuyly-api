const { Sequelize, DataTypes } = require('sequelize');  // <-- Ensure Sequelize is imported here
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

//const sequelize = new Sequelize(
  //process.env.DB_NAME,
  //process.env.DB_USER,
  //process.env.DB_PASSWORD,
  //{
    //host: process.env.DB_HOST,
    //dialect: 'mysql',
    //logging: false, 
  //}
//);

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
// Define relationships

db.Product.belongsTo(db.Category, { foreignKey: 'category_id', as: 'category' });
db.Category.hasMany(db.Product, { foreignKey: 'category_id', as: 'products' });

db.Product.hasMany(db.Variant, { foreignKey: 'product_id', as: 'variants' });
db.Variant.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });

// db.Variant.belongsTo(db.Color, { foreignKey: 'color_id', as: 'color' });
// db.Color.hasMany(db.Variant, { foreignKey: 'color_id', as: 'variants' });

// db.Variant.belongsTo(db.Weight, { foreignKey: 'weight_id', as: 'weight' });
// db.Weight.hasMany(db.Variant, { foreignKey: 'weight_id', as: 'variants' });


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

db.ProductImage.belongsTo(db.Product, { foreignKey: 'productId', as: 'product'});
db.Product.hasMany(db.ProductImage, { foreignKey: 'productId',as: 'images', onDelete: 'CASCADE',});

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

// db.Category.hasMany(db.Subcategory, { foreignKey: "category_id" });
// db.Subcategory.belongsTo(db.Category, { foreignKey: 'category_id', as: 'Subcategories' });

// db.Category.hasMany(db.Subcategory, { foreignKey: 'category_id', as: 'Subcategories' });
// db.Subcategory.belongsTo(db.Category, { foreignKey: 'category_id', as: 'Subcategories' });

// db.Category.hasMany(db.Subcategory, { foreignKey: "category_id", as: "subcategories" });
// db.Subcategory.belongsTo(db.Category, { foreignKey: "category_id", as: "Category" });

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

// Add this to your Subcategory model (if not already defined)
// In your Subcategory model:
// db.Subcategory.hasMany(db.Subcategory, {
//   foreignKey: "parent_id",  // The foreign key referring to the parent subcategory
//   as: "subcategories",      // Alias for nested subcategories
// });

// db.Subcategory.belongsTo(db.Subcategory, {
//   foreignKey: "parent_id",  // The foreign key pointing to the parent subcategory
//   as: "parent",             // Alias for the parent subcategory
// });


// fs.readdirSync(__dirname)
//   .filter((file) => file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js')
//   .forEach((file) => {
//     console.log(`Loading model from file: ${file}`);
//     const modelFile = require(path.join(__dirname, file));
//     console.log(`Loaded module for ${file}:`, modelFile);
//     const model = modelFile(sequelize, Sequelize.DataTypes); // This line may fail
//     db[model.name] = model;
//   });



// // Set up model associations
// Object.keys(db).forEach((modelName) => {
//   if (db[modelName].associate) {
//     db[modelName].associate(db);
//   }
// });

module.exports = db;
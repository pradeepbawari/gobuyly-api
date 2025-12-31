// models/productImages.js
module.exports = (sequelize, DataTypes) => {
  const Productimages = sequelize.define('Productimages', {
    // Define model attributes
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    public_id: {
      type: DataTypes.STRING,
      allowNull: false,      
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
	file_hash: {
        type: DataTypes.STRING(64),
        unique: true,
      },
  image_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    }, {
    tableName: 'productimages',
    timestamps: true,
  });

  // Return the model
  return Productimages;
};


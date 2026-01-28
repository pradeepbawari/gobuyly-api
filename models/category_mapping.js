// models/productSubcategoryMap.js
module.exports = (sequelize, DataTypes) => {
  const ProductSubcategoryMap = sequelize.define(
    'ProductSubcategoryMap',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      subcategory_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'product_subcategory_map',
      timestamps: false,

      indexes: [
        {
          unique: true,
          fields: ['product_id', 'subcategory_id'],
        },
        {
          fields: ['product_id'],
        },
        {
          fields: ['subcategory_id'],
        },
      ],
    }
  );

  return ProductSubcategoryMap;
};

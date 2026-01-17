module.exports = (sequelize, DataTypes) => {
  const OrderWebsiteItems = sequelize.define('OrderWebsiteItems', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // product_id: {
    //   type: DataTypes.INTEGER,
    //   allowNull: false,
    // },

    variant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    gst: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    // total: {
    //   type: DataTypes.DECIMAL(10, 2),
    //   allowNull: false,
    //   defaultValue: 0,
    // },

    // dimType: {
    //   type: DataTypes.STRING,
    //   allowNull: true,
    // },

    // dimValue: {
    //   type: DataTypes.STRING,
    //   allowNull: true,
    // },

    // dimunitName: {
    //   type: DataTypes.STRING,
    //   allowNull: true,
    // },
    // slug: {
    //   type: DataTypes.STRING,
    //   allowNull: true,
    // },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // images: {
    //   type: DataTypes.JSON,
    //   allowNull: false
    // },
    //  title: {
    //   type: DataTypes.STRING,
    //   allowNull: true,
    // },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
  type: DataTypes.ENUM('PENDING', 'BOOKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'),
  allowNull: false
},
payment_status: {
  type: DataTypes.ENUM('PENDING','PAID','UNPAID','FREE','FAILED','RETURNED'),
  allowNull: false
}
  }, {
    tableName: 'order_websiste_items',
    timestamps: true, // enables createdAt and updatedAt
    createdAt: 'created_at',   // 👈 map Sequelize createdAt → created_at
    updatedAt: 'updated_at',   // 👈 map Sequelize updatedAt → updated_at
    // underscored: true // snake_case column names
  });

  return OrderWebsiteItems;
};

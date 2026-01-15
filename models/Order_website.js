module.exports = (sequelize, DataTypes) => {
  const OrderWebsite = sequelize.define('OrderWebsite', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    address: {
      type: DataTypes.JSON,
      allowNull: false
    },

    paymentDetails: {
      type: DataTypes.JSON,
      allowNull: false
    },

    status: {
      type: DataTypes.ENUM('PENDING', 'BOOKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'),
      defaultValue: "PENDING"
    },
	payment_status: {
      type: DataTypes.ENUM('PENDING', 'PAID', 'UNPAID', 'FREE', 'FAILED','RETURNED'),
      defaultValue: "PENDING"
    },

    referral: {
      type: DataTypes.STRING,
      allowNull: false
    },
	order_id: {
      type: DataTypes.STRING,
      allowNull: false
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    shipping: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  }, {
    tableName: 'order_website',
    timestamps: true,
    underscored: true // for snake_case column names
  });

  return OrderWebsite;
};

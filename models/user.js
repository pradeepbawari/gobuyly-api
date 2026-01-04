// models/user.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    // Define model attributes
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },    
    mobile_number: {
      type: DataTypes.STRING,
      allowNull: false,
	  unique: true
    },    
	  address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    gstin: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    client_status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    company: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pincode: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'Users',
    timestamps: true,
  });

  // Return the model
  return User;
};

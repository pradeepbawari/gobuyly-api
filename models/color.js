// models/color.js
module.exports = (sequelize, DataTypes) => {
	const Color = sequelize.define('Color', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      hex_code: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
    },
    {
      tableName: "Colors",
      timestamps: true, // No createdAt or updatedAt fields
      createdAt: "createdAt",  // default
      updatedAt: "updatedAt"   // default

    }
  );

  return Color;
};

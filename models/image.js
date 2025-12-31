// models/Image.js
module.exports = (sequelize, DataTypes) => {
  const Image = sequelize.define(
    'Image',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
        type: DataTypes.CHAR(64),
        unique: true,
        allowNull: false,
      },
    },
    {
      tableName: 'images',
      timestamps: true, // optional, if you want createdAt/updatedAt
    }
  );

  return Image;
};

// models/product.js
module.exports = (sequelize, DataTypes) => {
  const CompanyNew = sequelize.define('companies_new', {
    company_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.TEXT },
    contact: { type: DataTypes.STRING },
    // updatedAt: {type: DataTypes.timestamps}
  }, {
    tableName: 'companies_new',
    timestamps: true,
  });

  return CompanyNew;
};

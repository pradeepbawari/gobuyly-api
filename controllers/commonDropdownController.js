// controllers/userController.js
const db = require('../models');
const { fn, col } = require("sequelize");
const { Comments } = require('../models');

// Create User Comment
const createComments = async (req, res) => {
  try {
    const { order_id, comment_text } = req.body;

    if (!order_id || !comment_text) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const commentsData = await db.Comments.create({ order_id, comment_text });
    res.status(201).json({ message: 'Comments created successfully', commentsData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Comments by Order ID
const getComments = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const comments = await db.Comments.findAll({
      where: { order_id },
      attributes: ['comment_id', 'comment_text', 'updatedAt'],
      order: [['updatedAt', 'ASC']]
    });

    if (!comments || comments.length === 0) {
      return res.status(200).json({ message: 'No comments found for this order', comments });
    }

    res.status(200).json({ message: 'Comments fetched successfully', comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get All Items
const getAll = async (req, res) => {
  try {
    const { type } = req.params;
    const model = getModel(type);
    // const list = await model.findAll();
    // res.json(list);
    const [list, meta] = await Promise.all([
      model.findAll(),
      model.findOne({
        attributes: [[fn("MAX", col("updatedAt")), "lastUpdated"]],
        raw: true
      })
    ]);

    res.json({
      lastUpdated: meta.lastUpdated,
      data: list
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create Item
const create = async (req, res) => {
  try {
    const { type } = req.params;
    const model = getModel(type);
    const { name } = req.body;

    const exists = await model.findOne({ where: { name } });
    if (exists) return res.status(400).json({ error: "Item already exists" });

    const newItem = await model.create({ name });
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Item
const updateItem = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { name } = req.body;
    const model = getModel(type);

    const item = await model.findByPk(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    item.name = name;
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Item
const deleteItem = async (req, res) => {
  try {
    const { type, id } = req.params;
    const model = getModel(type);

    const item = await model.findByPk(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await item.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLastUpdated = async (req, res) => {
  try {
    const model = getModel(req.params.type);
    const lastUpdated = await checkLastUpdated(model);

    res.json({ lastUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const checkLastUpdated = async (model) => {
  const result = await model.findOne({
    attributes: [[fn("MAX", col("updatedAt")), "lastUpdated"]],
    raw: true
  });
  return result?.lastUpdated || null;
}

// Helper to resolve model by type
function getModel(type) {
  switch (type) {
    case 'companies': return db.companyNew;
    case 'colours': return db.Color;
    case 'dealers': return db.Dealer;
    case 'materials': return db.materialsList;
    case 'dimensiontype': return db.dimensionType;
    case 'dimensionunit': return db.dimensionUnit;
    default: throw new Error("Invalid type");
  }
}

module.exports = {
  createComments,
  getComments,
  create,
  getAll,
  updateItem,
  deleteItem,
  getLastUpdated
};

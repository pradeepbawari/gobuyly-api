// controllers/categoryController.js
const db = require("../models");
const { Category } = require('../models');

// Create a new category
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
	const category = await db.Category.create({ name });
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await db.Category.findAll();
    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCategoriesAndSubcategories1 = async (req, res) => {
  try {
    const categories = await db.Category.findAll({
      include: [{
        model: db.Subcategory,
        as: "subcategories", // Ensure this matches the alias in associations
        required: false, // Use LEFT JOIN to include even if there are no subcategories
      }],
      order: [["id", "ASC"], [{ model: db.Subcategory, as: "subcategories" }, "id", "ASC"]],
    });

    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories and subcategories:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getCategoriesAndSubcategories = async (req, res) => {
  try {
    // Fetch categories with their immediate subcategories
    const categories = await db.Category.findAll({
      include: [{
        model: db.Subcategory,
        as: "subcategories",  // Make sure this alias matches the association
        required: false,      // LEFT JOIN to include categories without subcategories
      }],
      order: [
        ["id", "ASC"], 
        [{ model: db.Subcategory, as: "subcategories" }, "id", "ASC"]
      ],
    });

    // Function to recursively fetch subcategories and their subcategories
    const getSubcategoriesRecursively = async (categoryId, parentId = null) => {
      const subcategories = await db.Subcategory.findAll({
        where: { category_id: categoryId, parent_id: parentId }, // Only fetch subcategories that match the parentId
        include: [{
          model: db.Subcategory,
          as: "subcategories",  // Ensure this matches the alias in associations
          required: false,      // LEFT JOIN
        }],
        order: [["id", "ASC"], [{ model: db.Subcategory, as: "subcategories" }, "id", "ASC"]],
      });

      // Process the subcategories recursively if they have their own subcategories
      for (const subcategory of subcategories) {
        subcategory.subcategories = await getSubcategoriesRecursively(categoryId, subcategory.id); // Set the parentId for recursion
      }

      return subcategories;
    };

    // Create the final response structure
    const categoriesWithSubcategories = await Promise.all(categories.map(async (category) => {
      const subcategories = await getSubcategoriesRecursively(category.id);
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        subcategories,
      };
    }));

    res.json({ categories: categoriesWithSubcategories });
  } catch (error) {
    console.error("Error fetching categories and subcategories:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};



const createCategoryWithSubcategories = async (req, res) => {
  const { categories } = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ message: "Categories array is required and cannot be empty" });
  }

  const transaction = await db.sequelize.transaction(); // ✅ Start transaction

  try {
    for (const categoryData of categories) {
      // ✅ Check if category exists, update if necessary
      let category = await db.Category.findOne({
        where: { id: categoryData.id || null },
        transaction
      });

      if (!category) {
        category = await db.Category.create(
          { name: categoryData.name },
          { transaction }
        );
      } else if (categoryData.name !== category.name) {
        await category.update({ name: categoryData.name }, { transaction });
      }

      // ✅ Recursive function to insert subcategories
      const insertSubcategories = async (subcategories, parentId = null) => {
        for (const subcategoryData of subcategories) {
          let subcategory = await db.Subcategory.findOne({
            where: { id: subcategoryData.id || null },
            transaction
          });

          if (!subcategory) {
            subcategory = await db.Subcategory.create(
              {
                name: subcategoryData.name,
                category_id: category.id,
                icon: subcategoryData.icon,
                parent_id: parentId
              },
              { transaction }
            );
          } else if (subcategoryData.name !== subcategory.name) {
            await subcategory.update({ name: subcategoryData.name }, { transaction });
          }

          if (subcategoryData.subcategories && subcategoryData.subcategories.length > 0) {
            await insertSubcategories(subcategoryData.subcategories, subcategory.id);
          }
        }
      };

      if (categoryData.subcategories && categoryData.subcategories.length > 0) {
        await insertSubcategories(categoryData.subcategories);
      }
    }

    await transaction.commit(); // ✅ Commit transaction
    return res.status(201).json({ message: "Categories and subcategories added successfully" });

  } catch (error) {
    await transaction.rollback(); // ❌ Rollback on failure
    console.error("Error inserting categories:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Update a category by ID
const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;

    const category = await db.Category.findByPk(id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    category.name = name || category.name;
    await category.save();

    res.status(200).json({ message: "Category updated successfully", category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a category by ID
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await db.Category.findByPk(id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    await category.destroy();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  getCategoriesAndSubcategories,
  createCategoryWithSubcategories
};

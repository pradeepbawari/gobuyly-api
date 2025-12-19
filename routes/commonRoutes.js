// routes/commonRoutes.js
const express = require('express');
const { getAll, create, updateItem, deleteItem, getLastUpdated } = require('../controllers/commonDropdownController');
const router = express.Router();

router.get('/:type', getAll);
router.post('/:type', create);

router.put('/:type/:id', updateItem);
router.delete('/:type/:id', deleteItem);

router.get('/:type/last-updated', getLastUpdated);

module.exports = router;

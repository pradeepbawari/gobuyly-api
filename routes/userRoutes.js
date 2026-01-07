// routes/userRoutes.js
const express = require('express');
const { createUser, getUsers, getUser, updateUser, deleteUser, loginUser, updateUserfron } = require('../controllers/userController');
const router = express.Router();

// POST: Create a new user
router.post('/create', createUser);

router.post('/login', loginUser);

// GET: Fetch all users
router.post('/all', getUsers);

// GET: Fetch a single user by ID
router.get('/users/:id', getUser);

// PUT: Update a user by ID
router.put('/update/:id', updateUser);
router.put('/userupdate', updateUserfron);

// DELETE: Delete a user by ID
router.delete('/delete/:id', deleteUser);

module.exports = router;

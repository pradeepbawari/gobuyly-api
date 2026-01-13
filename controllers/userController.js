const db = require('../models');
const bcrypt = require('bcrypt');
const { User } = db;
const { generateToken } = require('../utiles/auth');

// Create User
// const createUser = async (req, res) => {
//   try {
//     const { name, email, mobile_number, address = 'not set', client_status = 'royal', company = 'not set', gstin = 'not set', password, role = 'user' } = req.body;

//     if (!name || !email || !mobile_number || !password) {
//       return res.status(400).json({ error: 'All fields are required' });
//     }

//     // Check if email already exists
//     if (await User.findOne({ where: { email } })) {
//       return res.status(409).json({ error: 'Email is already registered. Try a different email.' });
//     }

//     // Check if mobile number already exists
//     if (await User.findOne({ where: { mobile_number } })) {
//       return res.status(409).json({ error: 'Mobile number is already registered. Try a different number.' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = await User.create({ name, email, mobile_number, address, client_status, company, gstin, password: hashedPassword, role });

//     res.status(201).json({ message: 'User created successfully', user });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile_number,
      address = 'not set',
      client_status = 'royal',
      company = 'not set',
      gstin = 'not set',
      password,
      role = 'user',
      pincode
    } = req.body?.form;
    
    if (!name || !email || !mobile_number || !password || !pincode) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (await User.findOne({ where: { email } })) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    if (await User.findOne({ where: { mobile_number } })) {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      mobile_number,
      address,
      client_status,
      company,
      gstin,
      password: hashedPassword,
      role,
      pincode
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Fetch All Users
const getUsers = async (req, res) => {
  try {
    const { limit = 10, offset = 0, filters = {} } = req.body;

    const users = await User.findAndCountAll({
      where: filters,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Fetch Single User
const getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Update User
const updateUser = async (req, res) => {
  try {
    console.log(id, ...updateFields)
    if (!id) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update(updateFields);
    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update User
const updateUserfron = async (req, res) => {
  try {
    const { id, ...updateFields } = req?.body;
    if (!id) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update(updateFields);
    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete User
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// User Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body?.form;
    
    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user.id);
    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const updateUserNew = async (req, res) => {
  try {
    const { id, ...updateFields } = req.body;
    
    if (!id) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update(updateFields.userData);
    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createUser, getUsers, getUser, updateUser, deleteUser, loginUser, updateUserfron, updateUserNew };
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./models');
const userRoutes = require('./routes/userRoutes');
const dealerRoutes = require('./routes/dealerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const searchRoutes = require('./routes/searchRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const categoryRoutesUser = require('./routes/categoryRoutesUser');
const productsRoutes = require('./routes/productsRoutes');
const productsRoutesUser = require('./routes/productsRoutesUser');
const checkLastUpdateRoutes = require('./routes/checkLastUpdateRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const uploadRoutes = require('./routes/uploadRoutes');  // Import your upload routes
const settingRoutes = require('./routes/settingRoutes');
const uploadPDFRoutes = require('./routes/uploadPDFRoutesRoutes');
const authenticate = require('./utiles/middleware');
const adminRoutes = require('./routes/adminRoutes');
const commentRoutes = require('./routes/commentRoutes');
const commonRoutes = require('./routes/commonRoutes');
const excelExportRoutes = require('./routes/excelExportRoutes');

// Import the upload middleware
const { upload, uploadPDF } = require('./uploadImages/imageUpload'); 
const setting = require('./models/setting');

const app = express();

const corsOptions = {
  // local
  //origin: ['http://gobuyly.com', 'http://admin.gobuyly.com', 'http://147.93.28.231', 'http://srv748278.hstgr.cloud', 'http://localhost:5173', 'http://localhost:5174'], 
  // production
    origin: ['http://gobuyly.com', 'http://www.gobuyly.com', 'http://api.gobuyly.com', 'https://gobuyly.com', 'https://www.gobuyly.com', 'https://api.gobuyly.com', 'https://www.api.gobuyly.com'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Required if using cookies or tokens
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests


// Set the port production
//  const PORT = process.env.PORT || 5000;

// Set the port local
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize the multer upload middleware
const createUpload = upload.array('images', 10); 
const createUploadPDF = uploadPDF.single('pdf'); 

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/users', authenticate, userRoutes);
app.use('/api/dealers', authenticate, dealerRoutes);
app.use('/api/orders', authenticate, orderRoutes);
app.use('/api/categories', authenticate, categoryRoutes);
app.use('/api/products', authenticate, productsRoutes);
app.use('/api/categories_user', categoryRoutesUser);
app.use('/api/products_user', productsRoutesUser);
app.use('/api/data', authenticate, checkLastUpdateRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/invoice', authenticate, invoiceRoutes);
// app.use('/api/search', authenticate, searchRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/setting', authenticate, createUpload, settingRoutes);
app.use('/api/comments', authenticate, commentRoutes);
app.use('/api/front', commonRoutes);
app.use('/api', authenticate, commonRoutes);
app.use('/api/export', authenticate, excelExportRoutes);
 
// File upload route
app.use('/api/upload', authenticate, createUpload, uploadRoutes);  // Apply upload middleware to the '/upload' route
app.use('/api/invoice', authenticate, createUploadPDF, uploadPDFRoutes); 

// Test DB Connection
db.sequelize
  .authenticate()
  .then(() => console.log('Database connected bawari...'))
  .catch((err) => console.log('Error: ' + err));

// db.sequelize
//   .authenticate()
//   .then(() => console.log('Database connected bawari...'))
//   .catch((err) => console.log('Error: '));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

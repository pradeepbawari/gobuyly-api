// imageUpload.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const db = require("../models");
const path = require('path');
const { ProductImage, OrderImage, Setting } = require('../models'); // Adjust path if needed

// ------------------------
// Cloudinary Configuration
// ------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------------
// Multer Memory Storage
// ------------------------
const upload = multer({ storage: multer.memoryStorage() }); // For images
const uploadPDF = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // PDFs

// ------------------------
// Upload images to Cloudinary
// ------------------------
const uploadImagesToCloudinary = async (files) => {
  const uploadedImages = [];

  for (const file of files) {
    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'products' },
        (error, result) => {
          if (error) return reject(error);

          const publicId = result.public_id;

          uploadedImages.push({
            public_id: publicId,
            large_url: cloudinary.url(publicId, { width: 600, height: 780, crop: "limit", quality: "auto", fetch_format: "auto" }),
            thumbnail_url: cloudinary.url(publicId, { width: 290, height: 377, crop: "fit", quality: "auto", fetch_format: "auto" }),
          });

          resolve();
        }
      );
      stream.end(file.buffer);
    });
  }

  return uploadedImages;
};

// ------------------------
// Save images to database
// ------------------------
const saveImagesToDatabase = async (imageUrls, productId, productPage) => {
  if (productPage === 'productPage') {
    return db.ProductImage.bulkCreate(
      imageUrls.map((url) => ({
        image_url: url.large_url,
        image_thumbnail_url: url.thumbnail_url,
        product_id: productId,
        public_id: url.public_id
      }))
    );
  } else {
    return db.OrderImage.bulkCreate(
      imageUrls.map((url) => ({
        image_url: url.large_url,
        order_id: productId,
        public_id: url.public_id
      }))
    );
  }
};

// ------------------------
// Save logo to database
// ------------------------
const saveLogoToDatabase = async (imageUrls, id, email, mobile, address, gstin, company) => {
  try {
    const existingSetting = await db.Setting.findOne({ where: { id: id } });

    if (existingSetting) {
      await existingSetting.update({
        company,
        address,
        gstin,
        email,
        logo: imageUrls[0].url,
        public_id: imageUrls[0].key,
        mobile
      });
      return existingSetting;
    }

    const setting = imageUrls.map((url) => ({
      id,
      company,
      address,
      gstin,
      email,
      logo: url.url,
      public_id: url.key,
    }));

    await db.Setting.bulkCreate(setting);
    return setting;
  } catch (error) {
    console.error('Error saving logo to database:', error);
    throw new Error('Failed to save logo to database');
  }
};

// ------------------------
// Delete images from Cloudinary
// ------------------------
const deleteImagesFromCloudinary = async (imageIds) => {
  try {
    const deletePromises = imageIds.map((imageId) =>
      cloudinary.uploader.destroy(imageId)
    );
    const results = await Promise.all(deletePromises);

    results.forEach((result, index) => {
      if (result.result === 'ok') {
        console.log(`Image ${imageIds[index]} deleted successfully`);
      } else {
        console.error(`Failed to delete image ${imageIds[index]}`);
      }
    });

    return results;
  } catch (error) {
    console.error('Error deleting images from Cloudinary:', error);
    throw error;
  }
};

// ------------------------
// Delete images in DB
// ------------------------
const deleteImagesToDatabase = async (productId, imageId, publicId, page) => {
  await deleteImagesFromCloudinary([publicId]);
  if (page === 'productPage') {
    await db.ProductImage.destroy({ where: { product_id: productId, id: imageId } });
  } else {
    await db.OrderImage.destroy({ where: { order_id: productId, id: imageId } });
  }
};

const deleteLogoToDatabase = async (publicId) => {
  await deleteImagesFromCloudinary([publicId]);
};

// ------------------------
// Export all handlers
// ------------------------
module.exports = {
  upload,                // Image upload middleware
  uploadPDF,             // PDF upload middleware
  uploadImagesToCloudinary,
  saveImagesToDatabase,
  deleteImagesToDatabase,
  saveLogoToDatabase,
  deleteLogoToDatabase
};

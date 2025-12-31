const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const crypto = require('crypto');
const db = require("../models");
const { ProductImage, OrderImage, Setting } = require('../models');

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
const upload = multer({ storage: multer.memoryStorage() });
const uploadPDF = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ------------------------
// Generate SHA-256 Hash
// ------------------------
const generateHash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

// ------------------------
// Upload images to Cloudinary (with hash check)
// ------------------------
const uploadImagesToCloudinary1 = async (files, page = 'productPage') => {
  const uploadedImages = [];

  for (const file of files) {
    // 1️⃣ Generate hash
    const fileHash = generateHash(file.buffer);

    // 2️⃣ Select correct model
    const ImageModel = page === 'productPage' ? ProductImage : OrderImage;

    // 3️⃣ Check DB for existing image
    const existingImage = await ImageModel.findOne({ where: { file_hash: fileHash } });

    if (existingImage) {
      // Reuse existing image
      uploadedImages.push({
        public_id: existingImage.public_id,
        large_url: existingImage.image_url,
        thumbnail_url: existingImage.image_thumbnail_url || null,
        file_hash: existingImage.file_hash,
        reused: true
      });
      continue;
    }

    // 4️⃣ Upload to Cloudinary (new image)
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'products', public_id: fileHash, overwrite: false },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(file.buffer);
    });

    uploadedImages.push({
      public_id: result.public_id,
      large_url: cloudinary.url(result.public_id, { width: 600, height: 780, crop: "limit", quality: "auto", fetch_format: "auto" }),
      thumbnail_url: cloudinary.url(result.public_id, { width: 290, height: 377, crop: "fit", quality: "auto", fetch_format: "auto" }),
      file_hash: fileHash,
      reused: false
    });
  }

  return uploadedImages;
};

const uploadImagesToCloudinary = async (files) => {
  const uploadedImages = [];

  for (const file of files) {
    const fileHash = generateHash(file.buffer);

    // 1️⃣ Check if image exists in central Images table
    let image = await db.Image.findOne({ where: { file_hash: fileHash } });

    if (!image) {
      // 2️⃣ Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'products', public_id: fileHash, overwrite: false },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(file.buffer);
      });

      // 3️⃣ Save in Images table
      image = await db.Image.create({
        public_id: result.public_id,
        image_url: result.secure_url,
        file_hash: fileHash
      });
    }

    uploadedImages.push(image); // contains id, public_id, url, file_hash
  }

  return uploadedImages;
};

// ------------------------
// Save images to database
// ------------------------
const saveImagesToDatabase1 = async (imageUrls, productId, productPage) => {
  if (productPage === 'productPage') {
    return db.ProductImage.bulkCreate(
      imageUrls.map((url) => ({
        image_url: url.large_url,
        image_thumbnail_url: url.thumbnail_url,
        product_id: productId,        // ✅ keep your original condition
        public_id: url.public_id,
        file_hash: url.file_hash       // ✅ added hash
      })),
      { ignoreDuplicates: true }       // ✅ prevent inserting duplicates
    );
  } else {
    return db.OrderImage.bulkCreate(
      imageUrls.map((url) => ({
        image_url: url.large_url,
        order_id: productId,            // ✅ keep your original condition
        public_id: url.public_id,
        file_hash: url.file_hash        // ✅ added hash
      })),
      { ignoreDuplicates: true }       // ✅ prevent inserting duplicates
    );
  }
};

const saveImagesToDatabase = async (images, productId, productPage) => {	
  if (productPage === 'productPage') {
    return db.ProductImage.bulkCreate(
      images?.map((img) => ({
        product_id: productId,
        image_id: img?.id
      })),
      { ignoreDuplicates: true }
    );
  } else {
    return db.OrderImage.bulkCreate(
      images.map((img) => ({
        order_id: productId,
        image_id: img?.id,
      })),
      { ignoreDuplicates: true }
    );
  }
};


// ------------------------
// Delete images from Cloudinary
// ------------------------
const deleteImagesFromCloudinary = async (imageIds) => {
  return Promise.all(
    imageIds.map((id) => cloudinary.uploader.destroy(id))
  );
};

// ------------------------
// Delete images in DB
// ------------------------
const deleteImagesToDatabase = async (pImageId, productId, imageId, publicId, page) => {
  //await deleteImagesFromCloudinary([publicId]);

  //if (page === 'productPage') {
    await ProductImage.destroy({ where: { id: pImageId, product_id: productId, image_id: imageId } });
  //} else {
    //await OrderImage.destroy({ where: { order_id: productId, id: imageId } });
  //}
};

// ------------------------
// Export handlers
// ------------------------
module.exports = {
  upload,
  uploadPDF,
  uploadImagesToCloudinary,
  saveImagesToDatabase,
  deleteImagesToDatabase
};

const Product = require("../model/productSchema");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const slugify = require("slugify");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const stream = require('stream');
require("dotenv").config();

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CLOUDINARY_FOLDER = "ecommerce/products";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Multer configuration
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});;

// Utility Functions
async function uploadToCloudinary(files) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const uploadResults = [];

  for (const file of files) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'uploads' },
          (error, result) => error ? reject(error) : resolve(result)
        );

        // Create a stream from buffer
        const stream = require('stream');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);
        bufferStream.pipe(uploadStream);
      });

      uploadResults.push({
        url: result.secure_url,
        public_id: result.public_id
      });
    } catch (err) {
      console.error(`Failed to upload ${file.originalname}:`, err);
      // Consider whether to continue or abort on single failure
    }
  }

  return uploadResults;
}

const processImages = async (files) => {
  const uploadedImages = await Promise.all(
    files.map((file) => uploadToCloudinary(file))
  );
  return uploadedImages.filter((img) => img);
};

// Create Product
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      brand,
      price,
      oldPrice = null,  // Default values
      category,
      subCategory = null,
      countInStock,
      discount = 0,
      productRam = null,
      size = null,
      productWeight = null,
      location = null,
      isFeatured = false,
      images = []       // Now properly handled
    } = req.body;

    // Required fields validation
    const requiredFields = { name, description, brand, price, category, countInStock, images };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }

    const randomString = Math.random().toString(36).substring(2, 8);
    const slug = slugify(`${name}-${randomString}`, {
      lower: true,
      strict: true
    });

    // Create and save product
    const product = await Product.create({
      name,
      slug,
      description,
      brand,
      price: Number(price),
      oldPrice: Number(oldPrice),
      category,
      subCategory,
      countInStock: Number(countInStock),
      discount: Number(discount),
      productRam,
      size,
      productWeight,
      location,
      isFeatured,
      images
    });

    res.status(201).json({ success: true, data: product });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get All Products
router.get('/', async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const skip = (page - 1) * limit;

    // Filtering
    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.subCategory) {
      filter.subCategory = req.query.subCategory;
    }
    if (req.query.brand) {
      filter.brand = req.query.brand;
    }
    if (req.query.isFeatured) {
      filter.isFeatured = req.query.isFeatured === 'true';
    }

    // Sorting
    let sort = {};
    if (req.query.sortBy) {
      const sortParts = req.query.sortBy.split(':');
      sort[sortParts[0]] = sortParts[1] === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Search
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { brand: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name')
        .populate('subCategory', 'name'),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// Get Single Product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID"
      });
    }

    const product = await Product.findById(id)
      .populate('category', 'name')
      .populate('subCategory', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// Update Product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    res.json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// Delete Product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(
        product.images.map(async (image) => {
          try {
            await cloudinary.uploader.destroy(image.public_id);
          } catch (err) {
            console.error(`Failed to delete image ${image.public_id}:`, err);
          }
        })
      );
    }

    await Product.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// Delete Product Image
router.delete('/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const { imageId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID"
      });
    }

    if (!imageId) {
      return res.status(400).json({
        success: false,
        error: "Image ID is required"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    // Find the image to delete
    const imageIndex = product.images.findIndex(img => img._id == imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Image not found"
      });
    }

    const imageToDelete = product.images[imageIndex];

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(imageToDelete.public_id);
    } catch (err) {
      console.error(`Failed to delete image ${imageToDelete.public_id}:`, err);
      // Continue even if Cloudinary deletion fails
    }

    // Remove from product images array
    product.images.splice(imageIndex, 1);
    await product.save();

    res.json({
      success: true,
      message: "Image deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting product image:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// View Product Details
router.get('/view/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug })
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    // Get related products (same category)
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id }
    })
      .limit(4)
      .select('name slug price images')
      .lean();

    res.json({
      success: true,
      data: {
        product,
        relatedProducts
      }
    });

  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// Add this before module.exports = router;

router.post('/upload', upload.array('images'), async (req, res) => {
  try {
    console.log('Received files:', req.files); // Debug log

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files received in the request'
      });
    }

    // Upload to Cloudinary
    const cloudinaryResults = await uploadToCloudinary(req.files);

    res.json({
      success: true,
      files: cloudinaryResults,
      message: `${req.files.length} file(s) uploaded successfully`
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'File upload failed'
    });
  }
});

router.delete('/delete-image', async (req, res) => {
  try {
    const { publicId } = req.body;

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Optionally delete from your database
    // ... your database logic here

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
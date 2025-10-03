const Category = require("../model/category");
const mongoose = require("mongoose");
const { ImageUpload } = require("../model/imageupload");
const express = require("express");
const router = express.Router();
const slugify = require("slugify");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const stream = require('stream');

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_COLOR = "#FFFFFF";
const CLOUDINARY_FOLDER = "ecommerce/categories";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Utility Functions
// Updated uploadToCloudinary function
const uploadToCloudinary = async (file) => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: CLOUDINARY_FOLDER,
          resource_type: "auto"
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );

      // Create a buffer stream from the file buffer
      const bufferStream = new stream.PassThrough();
      bufferStream.end(file.buffer);
      bufferStream.pipe(uploadStream);
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

const processImages = async (files) => {
  const uploadedImages = await Promise.all(
    files.map((file) => uploadToCloudinary(file))
  );
  return uploadedImages.filter((url) => url);
};

// Add category
router.post('/', async (req, res) => {
  try {
    const existingCategory = await Category.findOne({
      name: req.body.name.trim()
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: "duplicate: Category with this name already exists"
      });
    }
    console.log("Received POST data:", req.body); // Debug log

    const { name, images, color, parentId } = req.body;

    // Enhanced validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required',
        field: 'name'
      });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one image is required',
        field: 'images'
      });
    }

    // Generate slug if not provided
    const slug = req.body.slug || slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });

    // Create new category
    const category = new Category({
      name,
      slug,
      color: color || DEFAULT_COLOR,
      images,
      parentId: parentId || null
    });

    // Save to database
    const savedCategory = await category.save();

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        id: savedCategory.id,
        name: savedCategory.name,
        slug: savedCategory.slug,
        images: savedCategory.images,
        color: savedCategory.color,
        parentId: savedCategory.parentId
      }
    });

  } catch (error) {
    if (error.code === 11000) { // MongoDB duplicate key error
      return res.status(400).json({
        success: false,
        error: "duplicate: Category with this name already exists"
      });
    }

    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
    console.error('Category creation error:', error);

    // Handle duplicate key error (unique slug)
    if (error.code === 11000 && error.keyPattern.slug) {
      return res.status(409).json({
        success: false,
        error: 'Category with this slug already exists',
        field: 'slug'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Add Image
router.post('/upload', upload.array('images', 5), async (req, res) => {
  try {
    console.log("Files received:", req.files); // Debugging line
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedImages = await Promise.all(
      req.files.map(file => uploadToCloudinary(file))
    );

    const imageUpload = await ImageUpload.create({ images: uploadedImages });

    res.status(201).json({ success: true, data: imageUpload.images });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

// Remove Image
router.delete("/delete", async (req, res) => {
  try {
    console.log("Request Body:", req.body); // Debugging

    const { imgUrl } = req.body; // Extract imgUrl

    if (!imgUrl) {
      return res.status(400).json({
        success: false,
        error: "imgUrl is required",
      });
    }

    console.log("Received imgUrl:", imgUrl); // Debugging

    // Extract public ID from Cloudinary URL
    const publicId = imgUrl.split("/").slice(-2).join("/").split(".")[0];
    console.log("Public ID:", publicId); // Debugging

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Delete from database
    await ImageUpload.updateMany({}, { $pull: { images: imgUrl } });

    return res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// Fetch Category
// Get Categories (Hierarchical)
// --------------------------
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find();
    if (!categories || categories.length === 0) {
      return res.status(404).json({ success: false, message: "No categories found" });
    }
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// --------------------------
// Get Category Counts
// --------------------------
router.get("/counts", async (req, res) => {
  try {
    const [parentCount, subCategoryCount] = await Promise.all([
      Category.countDocuments({ parentID: null }),
      Category.countDocuments({ parentID: { $ne: null } }),
    ]);

    return res.json({
      success: true,
      data: {
        parentCategories: parentCount,
        subCategories: subCategoryCount,
      },
    });
  } catch (error) {
    console.error("Error fetching category counts:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Fetch Single Category
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category ID format"
      });
    }

    const category = await Category.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found"
      });
    }

    return res.json({
      success: true,
      data: category
    });

  } catch (error) {
    console.error("Error fetching category:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Edit Category
router.put("/:id", upload.array("images", MAX_FILES), async (req, res) => {
  try {
    const { name, slug, color, parentID } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Process new image uploads
    const newImages = req.files?.length ? await processImages(req.files) : [];

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      {
        name: name || category.name,
        slug: slug
          ? slugify(slug.trim(), { lower: true, strict: true })
          : category.slug,
        color: color || category.color,
        images: [...category.images, ...newImages],
        parentID: parentID || category.parentID,
      },
      { new: true }
    );

    return res.json({
      success: true,
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);

    // Cleanup files if error occurred
    if (req.files?.length) {
      req.files.forEach(
        (file) => fs.existsSync(file.path) && fs.unlinkSync(file.path)
      );
    }

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete Category
router.delete("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Delete images from Cloudinary
    if (category.images?.length) {
      await Promise.all(
        category.images.map(async (imgUrl) => {
          try {
            const publicId = imgUrl.split("/").slice(-2).join("/").split(".")[0];
            console.log("Deleting Image:", publicId);
            await cloudinary.uploader.destroy(publicId);
          } catch (err) {
            console.error(`Failed to delete ${publicId}:`, err);
          }
        })
      );
    }

    await Category.findByIdAndDelete(req.params.id); // ✅ Fixed

    return res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


module.exports = router;


// Example Express route
// Add to your category routes file (near the bottom)
router.get('/:id/product-count', async (req, res) => {
  try {
    // Validate category ID
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID'
      });
    }

    const count = await Product.countDocuments({
      category: req.params.id
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error counting products:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});
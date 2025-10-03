// routes/subcategory.js
const express = require("express");
const router = express.Router();
const SubCategory = require("../model/subcategorySchema");
const Category = require("../model/category");
const mongoose = require("mongoose");

// Create subcategory (standalone)
router.post('/', async (req, res) => {
  try {
    const { name, parentId } = req.body;

    // Validate inputs
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Subcategory name is required"
      });
    }

    if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid parent category ID"
      });
    }

    // Check if parent exists if provided
    if (parentId) {
      const parentExists = await Category.findById(parentId);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          error: "Parent category not found"
        });
      }
    }

    // Check for duplicate
    const existingSub = await SubCategory.findOne({
      name: name.trim(),
      parentId: parentId || null
    });

    if (existingSub) {
      alert("Subcategory with this name already exists")
return res.status(400).json({
  success: false,
});
    }

// Create and save
const subcategory = new SubCategory({
  name: name.trim(),
  parentId: parentId || null
});

await subcategory.save();

// If has parent, add to parent's subcategories
if (parentId) {
  await Category.findByIdAndUpdate(parentId, {
    $push: { subcategories: subcategory._id }
  });
}

res.status(201).json({
  success: true,
  data: subcategory
});

  } catch (error) {
  console.error("Error creating subcategory:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
}
});

// Delete subcategory
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid subcategory ID"
      });
    }

    // Find and remove from parent category first
    const subcategory = await SubCategory.findById(id);
    if (subcategory?.parentId) {
      await Category.findByIdAndUpdate(subcategory.parentId, {
        $pull: { subcategories: id }
      });
    }

    // Then delete the subcategory
    await SubCategory.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Subcategory deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting subcategory:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});


// Add this new route to your existing subcategory routes
router.get('/with-parent', async (req, res) => {
  try {
    // Optional query parameters for filtering
    const {
      parentId,       // Filter by specific parent ID
      name,           // Filter by subcategory name
      sort = 'name',  // Default sort field
      order = 'asc'   // Default sort order
    } = req.query;

    // Build the aggregation pipeline
    const pipeline = [];

    // Optional: Match stage for filtering
    const matchStage = {};
    if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
      matchStage.parentId = new mongoose.Types.ObjectId(parentId);
    }
    if (name) {
      matchStage.name = { $regex: name, $options: 'i' }; // Case-insensitive search
    }
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Main lookup and transformation
    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'parentId',
          foreignField: '_id',
          as: 'parentCategory'
        }
      },
      {
        $unwind: {
          path: '$parentCategory',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: { $toLower: '$name' }, // Add slug field
          parentId: 1,
          parentCategory: {
            $cond: {
              if: { $eq: ['$parentCategory', null] },
              then: null,
              else: {
                name: '$parentCategory.name',
                slug: '$parentCategory.slug',
                images: '$parentCategory.images',
                color: '$parentCategory.color',
                _id: '$parentCategory._id'
              }
            }
          },
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: {
          [sort]: order === 'asc' ? 1 : -1
        }
      }
    );

    // Execute aggregation
    const subcategories = await SubCategory.aggregate(pipeline);

    // Format response
    const response = {
      success: true,
      count: subcategories.length,
      data: subcategories.map(sub => ({
        ...sub,
        // Ensure consistent null parentCategory format
        parentCategory: sub.parentCategory || null
      }))
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching subcategories with parents:", error);

    // More specific error handling
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: "Invalid ID format",
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        message: error.message
      })
    });
  }
});

// Add this route to get subcategories by parent category ID
router.get('/by-parent/:parentId', async (req, res) => {
  try {
    const { parentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid parent category ID"
      });
    }

    // Check if parent exists
    const parentExists = await Category.findById(parentId);
    if (!parentExists) {
      return res.status(404).json({
        success: false,
        error: "Parent category not found"
      });
    }

    // Get subcategories for this parent
    const subcategories = await SubCategory.find({ parentId })
      .select('name parentId')
      .lean();

    // Add parent category info to each subcategory
    const result = subcategories.map(sub => ({
      ...sub,
      parentCategory: {
        name: parentExists.name,
        images: parentExists.images,
        color: parentExists.color
      }
    }));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Error fetching subcategories by parent:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});
module.exports = router;
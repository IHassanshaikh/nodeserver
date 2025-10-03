const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../model/reviewSchema');
const Product = require('../model/productSchema'); // Add this import

// Create Review and Update Product
router.post('/', async (req, res) => {
  try {
    const { product, rating, comment } = req.body;
    let { user } = req.body;

    if (!mongoose.Types.ObjectId.isValid(product)) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }

    // If user is not provided or not a valid ObjectId, set to null
    if (!user || !mongoose.Types.ObjectId.isValid(user)) {
      user = null;
    }

    // Create new review
    const review = new Review({
      product,
      user,
      rating,
      comment
    });
    await review.save();

    // Update product with the new rating
    const updatedProduct = await Product.findByIdAndUpdate(
      product,
      {
        $push: {
          ratings: {
            rating: Number(rating),
            review: comment,
            user: user || undefined // Only include if user exists
          }
        },
        $inc: { numReviews: 1 }
      },
      { new: true }
    );

    // Calculate new average rating
    if (updatedProduct) {
      const sum = updatedProduct.ratings.reduce((acc, item) => acc + item.rating, 0);
      updatedProduct.averageRating = Math.round((sum / updatedProduct.ratings.length) * 10) / 10;
      await updatedProduct.save();
    }

    res.status(201).json({
      success: true,
      data: {
        review,
        product: updatedProduct
      }
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Get All Reviews for a Product
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }

    const reviews = await Review.find({ product: productId }).sort({ createdAt: -1 });
    const product = await Product.findById(productId);

    res.json({
      success: true,
      data: {
        reviews,
        averageRating: product?.averageRating || 0,
        numReviews: product?.numReviews || 0
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete a single review by review ID
router.delete('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Validate review ID format
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid review ID format'
      });
    }

    // Find and delete the review
    const deletedReview = await Review.findByIdAndDelete(reviewId);

    if (!deletedReview) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    // Update the associated product
    const updatedProduct = await Product.findByIdAndUpdate(
      deletedReview.product,
      {
        $pull: { ratings: { _id: reviewId } },
        $inc: { numReviews: -1 }
      },
      { new: true }
    );

    // Recalculate average rating if needed
    if (updatedProduct) {
      if (updatedProduct.ratings.length > 0) {
        const sum = updatedProduct.ratings.reduce((acc, item) => acc + item.rating, 0);
        updatedProduct.averageRating = parseFloat((sum / updatedProduct.ratings.length).toFixed(1));
      } else {
        updatedProduct.averageRating = 0;
      }
      await updatedProduct.save();
    }

    res.json({
      success: true,
      message: 'Review deleted successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    maxlength: [100, "Product name cannot exceed 100 characters"]
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    required: [true, "Product description is required"],
    maxlength: [2000, "Description cannot exceed 2000 characters"]
  },
  brand: {
    type: String,
    required: [true, "Brand is required"],
    maxlength: [50, "Brand name cannot exceed 50 characters"]
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price must be at least 0"]
  },
  oldPrice: {
    type: Number,
    min: [0, "Old price must be at least 0"]
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: [true, "Category is required"]
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory"
  },
  countInStock: {
    type: Number,
    required: [true, "Stock count is required"],
    min: [0, "Stock count cannot be negative"]
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, "Discount cannot be negative"],
    max: [100, "Discount cannot exceed 100%"]
  },
  productRam: {
    type: [String],
    enum: ["2GB", "4GB", "6GB", "8GB", "12GB", "16GB", "32GB"],
    default: []
  },
  size: {
    type: [String],
    enum: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
    default: []
  },
  productWeight: {
    type: [String],
    enum: ["500g", "1kg", "1.5kg", "2kg", "2.5kg", "3kg", "5kg"],
    default: []
  },
  location: {
    type: String,
    maxlength: [100, "Location cannot exceed 100 characters"]
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    public_id: {
      type: String,
      required: true
    }
  }],
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug before saving
productSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Calculate average rating
productSchema.methods.calculateAverageRating = function () {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.numReviews = 0;
    return;
  }

  const sum = this.ratings.reduce((acc, item) => acc + item.rating, 0);
  this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
  this.numReviews = this.ratings.length;
};

// Update average rating after saving reviews
productSchema.post("save", function (doc) {
  doc.calculateAverageRating();
});

// Update average rating after updating reviews
productSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    await doc.calculateAverageRating();
    await doc.save();
  }
});

productSchema.methods.updateAverageRating = async function () {
  const reviews = await Review.find({ product: this._id });
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);

  this.ratings = reviews.map(review => ({
    user: review.user,
    rating: review.rating,
    review: review.comment
  }));

  this.numReviews = reviews.length;
  this.averageRating = reviews.length > 0
    ? Math.round((sum / reviews.length) * 10) / 10
    : 0;

  await this.save();
};

module.exports = mongoose.model("Product", productSchema);
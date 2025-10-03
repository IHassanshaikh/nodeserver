const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true       // Ensures faster searches on the slug field
  },
  images: {
    type: [String],
    default: []
  },
  color: {
    type: String,
    default: "#FFFFFF",
    validate: {
      validator: function (v) {
        return /^#([0-9A-F]{3}){1,2}$/i.test(v); // Validates HEX color codes
      },
      message: props => `${props.value} is not a valid hex color code!`
    }
  },
  subcategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' }]
  ,
  parentID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
    validate: {
      validator: async function (value) {
        if (!value) return true; // Allow null parentID
        const category = await mongoose.model("Category").findById(value);
        return !!category; // Returns true if category exists
      },
      message: "Parent category does not exist."
    }
  }

}, { timestamps: true });

// Virtual property to return `id` instead of `_id`
categorySchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Ensure virtuals are included when converting to JSON
categorySchema.set("toJSON", {
  virtuals: true
});

module.exports = mongoose.model("Category", categorySchema);

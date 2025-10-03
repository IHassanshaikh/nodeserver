const mongoose = require("mongoose");

const imageUploadSchema = new mongoose.Schema({
  images: [{
    type: String,
    required: true,
  }]
});

// Virtual property to return `id` instead of `_id`
imageUploadSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Ensure virtuals are included when converting to JSON
imageUploadSchema.set("toJSON", {
  virtuals: true
});

// Export model
const ImageUpload = mongoose.model("ImageUpload", imageUploadSchema);
module.exports = { ImageUpload, imageUploadSchema };

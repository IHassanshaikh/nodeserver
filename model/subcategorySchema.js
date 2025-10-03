const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, ref:'SubCategory' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }
});

module.exports = mongoose.model('SubCategory', subcategorySchema);
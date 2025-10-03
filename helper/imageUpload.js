const express = require("express");
const router = express.Router();
const { imageUpload } = require("../model/imageupload"); // Ensure correct import

// Get all uploaded images
router.get("/", async (req, res) => {
  try {
    const imageUploadList = await imageUpload.find();

    if (!imageUploadList || imageUploadList.length === 0) {
      return res.status(404).json({ success: false, message: "No images found" });
    }

    return res.status(200).json(imageUploadList);
  } catch (error) {
    console.error("Error fetching images:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all images
router.delete("/deleteAllImages", async (req, res) => {
  try {
    const images = await imageUpload.find();

    if (images.length === 0) {
      return res.status(404).json({ success: false, message: "No images to delete" });
    }

    let deletedImages = [];
    for (let image of images) {
      const deleted = await imageUpload.findByIdAndDelete(image.id);
      deletedImages.push(deleted);
    }

    return res.json({ success: true, deletedImages });
  } catch (error) {
    console.error("Error deleting images:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Corrected Export
module.exports = router;

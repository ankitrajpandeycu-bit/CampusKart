
import express from "express";
import fs from "fs/promises";
import Product from "../models/Product.js";
import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Delete uploaded files if product creation fails
const removeUploadedFiles = async (files = []) => {
  await Promise.all(
    files.map((file) =>
      fs.unlink(file.path).catch(() => {})
    )
  );
};

// GET: Fetch all available products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({ isSold: false })
      .populate("seller", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET: Fetch logged-in user's products
router.get("/my-listings", protect, async (req, res) => {
  try {
    const products = await Product.find({
      seller: req.user._id
    })
      .populate("seller", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST: Add a new product with up to 5 images
router.post("/", protect, (req, res, next) => {
  upload.array("images", 5)(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next();
  });
}, async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      image,
      location
    } = req.body || {};

    if (
      !title?.trim() ||
      !description?.trim() ||
      price === undefined ||
      price === "" ||
      !category?.trim()
    ) {
      await removeUploadedFiles(uploadedFiles);

      return res.status(400).json({
        success: false,
        message: "Please provide title, description, price and category"
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      await removeUploadedFiles(uploadedFiles);

      return res.status(400).json({
        success: false,
        message: "Please provide a valid price"
      });
    }

    const images = uploadedFiles.map(
      (file) => `/uploads/${file.filename}`
    );

    const product = await Product.create({
      title: title.trim(),
      description: description.trim(),
      price: numericPrice,
      category: category.trim(),
      condition,
      image: images[0] || image || "",
      images,
      location,
      seller: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Product added successfully!",
      product
    });
  } catch (error) {
    await removeUploadedFiles(uploadedFiles);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE: Delete own product
router.delete("/:id", protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (
      !product.seller ||
      product.seller.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own products"
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

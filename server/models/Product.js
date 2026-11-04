
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    category: {
      type: String,
      required: true
    },

    condition: {
      type: String,
      enum: ["New", "Like New", "Good", "Fair"],
      default: "Good"
    },

    // Keep old image field for existing products
    image: {
      type: String,
      default: ""
    },

    // Store multiple uploaded image paths
    images: {
      type: [String],
      default: []
    },

    location: {
      type: String,
      default: "College Campus"
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    isSold: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

export default Product;

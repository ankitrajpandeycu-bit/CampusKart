
import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import Product from "../models/Product.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// SEND MESSAGE TO SELLER
router.post("/", async (req, res) => {
  try {
    const { productId, text } = req.body;

    if (!productId || !text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product and message are required."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 1000 characters."
      });
    }

    const product = await Product.findById(productId);

    if (!product || product.isSold) {
      return res.status(404).json({
        success: false,
        message: "Product is unavailable."
      });
    }

    if (!product.seller) {
      return res.status(400).json({
        success: false,
        message: "Seller information is unavailable."
      });
    }

    if (product.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself."
      });
    }

    const newMessage = await Message.create({
      sender: req.user._id,
      receiver: product.seller,
      product: product._id,
      text: text.trim()
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name email")
      .populate("receiver", "name")
      .populate("product", "title price");

    res.status(201).json({
      success: true,
      message: "Your message has been sent successfully!",
      data: populatedMessage
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// SELLER INBOX
router.get("/inbox", async (req, res) => {
  try {
    const messages = await Message.find({
      receiver: req.user._id
    })
      .populate("sender", "name email")
      .populate("product", "title price")
      .sort({ createdAt: -1 });

    const unreadCount = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      count: messages.length,
      unreadCount,
      messages
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// SENT MESSAGES
router.get("/sent", async (req, res) => {
  try {
    const messages = await Message.find({
      sender: req.user._id
    })
      .populate("receiver", "name email")
      .populate("product", "title price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      messages
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// UNREAD MESSAGE COUNT
router.get("/unread-count", async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// COMPLETE CONVERSATION
router.get("/conversation/:userId/:productId", async (req, res) => {
  try {
    const { userId, productId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation details."
      });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation participant."
      });
    }

    const conversationFilter = {
      product: productId,
      $or: [
        {
          sender: req.user._id,
          receiver: userId
        },
        {
          sender: userId,
          receiver: req.user._id
        }
      ]
    };

    const messages = await Message.find(conversationFilter)
      .populate("sender", "name")
      .populate("receiver", "name")
      .populate("product", "title price")
      .sort({ createdAt: 1 });

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    await Message.updateMany(
      {
        product: productId,
        sender: userId,
        receiver: req.user._id,
        isRead: false
      },
      {
        $set: { isRead: true }
      }
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      messages
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// REPLY TO AN EXISTING CONVERSATION
router.post("/reply", async (req, res) => {
  try {
    const { productId, receiverId, text } = req.body;

    if (!productId || !receiverId || !text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product, receiver and message are required."
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(receiverId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation details."
      });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 1000 characters."
      });
    }

    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself."
      });
    }

    const existingMessage = await Message.findOne({
      product: productId,
      $or: [
        {
          sender: req.user._id,
          receiver: receiverId
        },
        {
          sender: receiverId,
          receiver: req.user._id
        }
      ]
    });

    if (!existingMessage) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation."
      });
    }

    const newMessage = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      product: productId,
      text: text.trim()
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name")
      .populate("receiver", "name")
      .populate("product", "title price");

    res.status(201).json({
      success: true,
      message: "Reply sent successfully!",
      data: populatedMessage
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// MARK MESSAGE AS READ
router.patch("/:id/read", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID."
      });
    }

    const message = await Message.findOne({
      _id: req.params.id,
      receiver: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found."
      });
    }

    message.isRead = true;
    await message.save();

    res.status(200).json({
      success: true,
      message: "Message marked as read."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

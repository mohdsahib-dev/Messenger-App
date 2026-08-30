const express = require("express");
const Message = require("../models/Message");

const router = express.Router();

// ========================================
// GET CHAT HISTORY
// ========================================

router.get("/:roomId", async (req, res) => {
  try {
    const messages = await Message.find({
      roomId: req.params.roomId,
    }).sort({
      createdAt: 1,
    });

    res.status(200).json({
      success: true,
      messages,
    });

  } catch (error) {
    console.error(
      "Fetch messages error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
});

module.exports = router;
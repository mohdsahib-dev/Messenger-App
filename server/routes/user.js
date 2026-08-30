const express = require("express");
const User = require("../models/User");

const router = express.Router();

// GET ALL USERS EXCEPT CURRENT USER
router.get("/:userId", async (req, res) => {
  try {
    const users = await User.find({
      _id: {
        $ne: req.params.userId,
      },
    }).select("-password");

    res.status(200).json({
      success: true,
      users,
    });

  } catch (error) {
    console.error("Fetch users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

module.exports = router;
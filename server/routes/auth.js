const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");

const router = express.Router();

// ========================================
// REGISTER
// ========================================

router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
    } = req.body;

    // ======================================
    // VALIDATION
    // ======================================

    if (
      !username ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    // ======================================
    // NORMALIZE DATA
    // ======================================

    const cleanUsername =
      username.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    // ======================================
    // CHECK EXISTING USER
    // ======================================

    const existingUser =
      await User.findOne({
        $or: [
          {
            email: cleanEmail,
          },
          {
            username: cleanUsername,
          },
        ],
      });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          "Username or email already exists",
      });
    }

    // ======================================
    // HASH PASSWORD
    // ======================================

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    // ======================================
    // CREATE USER
    // ======================================

    const user =
      await User.create({
        username: cleanUsername,

        email: cleanEmail,

        password: hashedPassword,

        status: "online",
      });

    // ======================================
    // CREATE UNIQUE SESSION ID
    // ======================================

    const sessionId =
      crypto.randomUUID();

    // ======================================
    // JWT
    // ======================================

    const token =
      jwt.sign(
        {
          userId: user._id.toString(),

          // Unique login/session
          sessionId: sessionId,
        },

        process.env.JWT_SECRET,

        {
          expiresIn: "7d",
        }
      );

    // ======================================
    // RESPONSE
    // ======================================

    return res.status(201).json({
      success: true,

      message:
        "Registration successful",

      token,

      sessionId,

      user: {
        id: user._id,

        username:
          user.username,

        email:
          user.email,

        status:
          user.status,
      },
    });
  } catch (error) {
    console.error(
      "Register Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Server error",
    });
  }
});

// ========================================
// LOGIN
// ========================================

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    // ======================================
    // VALIDATION
    // ======================================

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Email and password are required",
      });
    }

    // ======================================
    // NORMALIZE EMAIL
    // ======================================

    const cleanEmail =
      email.trim().toLowerCase();

    // ======================================
    // FIND USER
    // ======================================

    const user =
      await User.findOne({
        email: cleanEmail,
      });

    if (!user) {
      return res.status(401).json({
        success: false,

        message:
          "Invalid email or password",
      });
    }

    // ======================================
    // CHECK PASSWORD
    // ======================================

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,

        message:
          "Invalid email or password",
      });
    }

    // ======================================
    // ONLINE STATUS
    // ======================================

    user.status = "online";

    await user.save();

    // ======================================
    // CREATE UNIQUE SESSION ID
    // ======================================

    const sessionId =
      crypto.randomUUID();

    // ======================================
    // CREATE JWT
    // ======================================

    const token =
      jwt.sign(
        {
          userId: user._id.toString(),

          // Unique session for this login
          sessionId: sessionId,
        },

        process.env.JWT_SECRET,

        {
          expiresIn: "7d",
        }
      );

    // ======================================
    // RESPONSE
    // ======================================

    return res.json({
      success: true,

      message:
        "Login successful",

      token,

      sessionId,

      user: {
        id: user._id,

        username:
          user.username,

        email:
          user.email,

        status:
          user.status,
      },
    });
  } catch (error) {
    console.error(
      "Login Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Server error",
    });
  }
});

// ========================================
// EXPORT ROUTER
// ========================================

module.exports = router;
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");

const router = express.Router();


// ========================================
// CREATE JWT TOKEN
// ========================================

const createToken = (user) => {

  return jwt.sign(
    {
      userId: user._id.toString(),
      sessionId: user.sessionId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

};


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

        message:
          "All fields are required",

      });

    }


    if (
      username.trim().length < 3
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Username must be at least 3 characters",

      });

    }


    if (
      password.length < 6
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Password must be at least 6 characters",

      });

    }


    // ======================================
    // CLEAN DATA
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
            email:
              cleanEmail,
          },

          {
            username:
              cleanUsername,
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
    // CREATE NEW SESSION ID
    // ======================================

    const sessionId =
      crypto.randomUUID();


    console.log(
      "🆕 New session created:",
      sessionId
    );


    // ======================================
    // CREATE USER
    // ======================================

    const user =
      await User.create({

        username:
          cleanUsername,

        email:
          cleanEmail,

        password:
          hashedPassword,

        status:
          "online",

        sessionId:
          sessionId,

      });


    // ======================================
    // CREATE JWT
    // ======================================

    const token =
      createToken(user);


    // ======================================
    // RESPONSE
    // ======================================

    return res.status(201).json({

      success: true,

      message:
        "Registration successful",

      token:

        token,

      sessionId:

        user.sessionId,

      user: {

        id:
          user._id,

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
    // CLEAN EMAIL
    // ======================================

    const cleanEmail =
      email.trim().toLowerCase();


    // ======================================
    // FIND USER
    // ======================================

    const user =
      await User.findOne({

        email:
          cleanEmail,

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
    // SESSION LIFECYCLE
    // ======================================

    /*
      IMPORTANT:

      Agar user ke database mein
      sessionId already hai:

          → Existing sessionId use karo

      Agar sessionId nahi hai:

          → New sessionId generate karo
          → MongoDB mein save karo
    */


    if (!user.sessionId) {

      user.sessionId =
        crypto.randomUUID();


      console.log(
        "🆕 Session ID generated for old user:",
        user.sessionId
      );

    } else {

      console.log(
        "♻️ Existing session reused:",
        user.sessionId
      );

    }


    // ======================================
    // USER ONLINE
    // ======================================

    user.status =
      "online";


    // ======================================
    // SAVE USER
    // ======================================

    await user.save();


    // ======================================
    // CREATE JWT
    // ======================================

    const token =
      createToken(user);


    // ======================================
    // RESPONSE
    // ======================================

    return res.json({

      success: true,

      message:
        "Login successful",

      token:

        token,

      sessionId:

        user.sessionId,

      user: {

        id:
          user._id,

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


module.exports = router;
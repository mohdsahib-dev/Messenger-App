require("dotenv").config();

const jwt = require("jsonwebtoken");
const User = require("./models/User");

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

// ========================================
// ROUTES
// ========================================

const fileRoutes = require("./routes/fileRoutes");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");

const Message = require("./models/Message");

// ========================================
// EXPRESS APP
// ========================================

const app = express();

const server = http.createServer(app);

// ========================================
// UPLOADS DIRECTORY
// ========================================

const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, {
    recursive: true,
  });

  console.log("Uploads folder created.");
}

// ========================================
// ALLOWED FRONTEND ORIGINS
// ========================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://messenger-app-cyan-two.vercel.app",
];

// ========================================
// CORS
// ========================================

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        "CORS blocked origin:",
        origin
      );

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    credentials: true,
  })
);

// ========================================
// BODY PARSER
// ========================================

app.use(express.json());

// ========================================
// FILE ROUTES
// ========================================

app.use(
  "/api/files",
  fileRoutes
);

// ========================================
// STATIC UPLOADED FILES
// ========================================

app.use(
  "/uploads",
  express.static(uploadsPath)
);

// ========================================
// API ROUTES
// ========================================

// Authentication
app.use(
  "/api/auth",
  authRoutes
);

// Users
app.use(
  "/api/users",
  userRoutes
);

// Messages
app.use(
  "/api/messages",
  messageRoutes
);

// ========================================
// TEST ROUTE
// ========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Messenger Backend is Running!",
  });
});

// ========================================
// SOCKET.IO
// ========================================

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        "Socket.IO CORS blocked origin:",
        origin
      );

      return callback(
        new Error(
          "Not allowed by Socket.IO CORS"
        )
      );
    },

    methods: [
      "GET",
      "POST",
    ],

    credentials: true,
  },
});

// ========================================
// MONGODB CONNECTION
// ========================================

if (!process.env.MONGO_URI) {
  console.error(
    "ERROR: MONGO_URI is not defined in .env"
  );
} else {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log(
        "MongoDB Connected Successfully"
      );
    })
    .catch((error) => {
      console.error(
        "MongoDB Connection Error:",
        error.message
      );
    });
}

// ========================================
// SOCKET AUTHENTICATION MIDDLEWARE
// ========================================

io.use(async (socket, next) => {
  try {
    // Get authentication data
    const {
      token,
      sessionId,
      userId,
    } = socket.handshake.auth || {};

    // ======================================
    // CHECK REQUIRED AUTH DATA
    // ======================================

    if (
      !token ||
      !sessionId ||
      !userId
    ) {
      console.error(
        "❌ Socket authentication data missing"
      );

      return next(
        new Error(
          "Authentication required"
        )
      );
    }

    // ======================================
    // CHECK JWT SECRET
    // ======================================

    if (!process.env.JWT_SECRET) {
      console.error(
        "❌ JWT_SECRET is not configured"
      );

      return next(
        new Error(
          "JWT_SECRET is not configured"
        )
      );
    }

    // ======================================
    // VERIFY JWT
    // ======================================

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // ======================================
    // VERIFY USER ID
    // ======================================

    if (
      String(decoded.userId) !==
      String(userId)
    ) {
      console.error(
        "❌ Invalid user ID"
      );

      return next(
        new Error("Invalid user")
      );
    }

    // ======================================
    // VERIFY SESSION ID
    // ======================================

    if (
      String(decoded.sessionId) !==
      String(sessionId)
    ) {
      console.error(
        "❌ Invalid session ID"
      );

      return next(
        new Error("Invalid session")
      );
    }

    // ======================================
    // FIND USER IN DATABASE
    // ======================================

    const user =
      await User.findById(userId);

    if (!user) {
      console.error(
        "❌ User not found:",
        userId
      );

      return next(
        new Error("User not found")
      );
    }

    // ======================================
    // VERIFY DATABASE SESSION
    // ======================================

    if (
      !user.sessionId ||
      String(user.sessionId) !==
        String(sessionId)
    ) {
      console.error(
        "❌ Database session mismatch"
      );

      return next(
        new Error("Session invalid")
      );
    }

    // ======================================
    // ATTACH TRUSTED USER DATA
    // ======================================

    socket.userId =
      user._id.toString();

    socket.sessionId =
      user.sessionId;

    socket.username =
      user.username;

    socket.user = user;

    console.log(
      "✅ Socket authentication successful"
    );

    console.log(
      "User ID:",
      socket.userId
    );

    console.log(
      "Username:",
      socket.username
    );

    console.log(
      "Session ID:",
      socket.sessionId
    );

    // ======================================
    // ALLOW CONNECTION
    // ======================================

    next();

  } catch (error) {
    console.error(
      "❌ Socket authentication error:",
      error.message
    );

    return next(
      new Error(
        "Authentication failed"
      )
    );
  }
});

// ========================================
// SOCKET CONNECTION
// ========================================

io.on("connection", (socket) => {

  // ======================================
  // TRUSTED USER INFORMATION
  // ======================================

  console.log(
    "✅ Authenticated user connected:",
    socket.id
  );

  console.log(
    "User ID:",
    socket.userId
  );

  console.log(
    "Username:",
    socket.username
  );

  console.log(
    "Session ID:",
    socket.sessionId
  );

  // ======================================
  // JOIN CHAT ROOM
  // ======================================

  socket.on(
    "join_room",
    (roomId) => {
      try {

        // ==================================
        // VALIDATE ROOM ID
        // ==================================

        if (!roomId) {
          console.error(
            "join_room: roomId is missing"
          );

          return;
        }

        // ==================================
        // CHECK ROOM MEMBERS
        // ==================================

        const roomParts =
          String(roomId).split("_");

        // Current authenticated user
        // must be part of the room

        if (
          !roomParts.includes(
            String(socket.userId)
          )
        ) {
          console.error(
            "❌ Unauthorized room join:",
            roomId
          );

          socket.emit(
            "message_error",
            {
              message:
                "Unauthorized room.",
            }
          );

          return;
        }

        // ==================================
        // JOIN ROOM
        // ==================================

        socket.join(roomId);

        console.log(
          `✅ ${socket.id} joined room: ${roomId}`
        );

      } catch (error) {
        console.error(
          "Join room error:",
          error
        );
      }
    }
  );

  // ======================================
  // SEND MESSAGE
  // ======================================

  socket.on(
    "send_message",
    async (data) => {

      try {

        console.log(
          "📩 Message received:",
          data
        );

        // ==================================
        // VALIDATE DATA
        // ==================================

        if (
          !data ||
          !data.roomId
        ) {
          socket.emit(
            "message_error",
            {
              message:
                "Room ID is required.",
            }
          );

          return;
        }

        // ==================================
        // GET ROOM MEMBERS
        // ==================================

        const roomParts =
          String(data.roomId).split("_");

        // ==================================
        // VERIFY SENDER
        // ==================================

        if (
          !roomParts.includes(
            String(socket.userId)
          )
        ) {
          console.error(
            "❌ Unauthorized message attempt:",
            data.roomId
          );

          socket.emit(
            "message_error",
            {
              message:
                "Unauthorized room.",
            }
          );

          return;
        }

        // ==================================
        // VALIDATE RECEIVER
        // ==================================

        if (!data.receiverId) {
          socket.emit(
            "message_error",
            {
              message:
                "Receiver ID is required.",
            }
          );

          return;
        }

        const receiverId =
          String(data.receiverId);

        // ==================================
        // VERIFY RECEIVER IS IN ROOM
        // ==================================

        if (
          !roomParts.includes(
            receiverId
          )
        ) {
          console.error(
            "❌ Receiver is not part of room:",
            receiverId
          );

          socket.emit(
            "message_error",
            {
              message:
                "Invalid receiver.",
            }
          );

          return;
        }

        // ==================================
        // CREATE MESSAGE
        // ==================================

        const newMessage =
          new Message({

            // Room
            roomId:
              data.roomId,

            // IMPORTANT:
            // Never trust senderId
            // from frontend

            senderId:
              socket.userId,

            // IMPORTANT:
            // Never trust username
            // from frontend

            senderUsername:
              socket.username,

            // Receiver can come
            // from frontend after
            // room validation

            receiverId:
              receiverId,

            // Text
            message:
              data.message || "",

            // File
            file:
              data.file || null,
          });

        // ==================================
        // SAVE MESSAGE TO MONGODB
        // ==================================

        const savedMessage =
          await newMessage.save();

        console.log(
          "✅ Message saved to MongoDB:",
          savedMessage._id
        );

        // ==================================
        // PREPARE MESSAGE RESPONSE
        // ==================================

        const messageData = {

          _id:
            savedMessage._id,

          roomId:
            savedMessage.roomId,

          senderId:
            savedMessage.senderId,

          receiverId:
            savedMessage.receiverId,

          username:
            savedMessage.senderUsername,

          message:
            savedMessage.message,

          file:
            savedMessage.file ||
            null,

          timestamp:
            savedMessage.createdAt,
        };

        // ==================================
        // SEND MESSAGE TO ROOM
        // ==================================

        io
          .to(data.roomId)
          .emit(
            "receive_message",
            messageData
          );

      } catch (error) {

        console.error(
          "❌ Message save error:",
          error
        );

        socket.emit(
          "message_error",
          {
            message:
              "Message could not be saved.",
          }
        );
      }
    }
  );

  // ======================================
  // DISCONNECT
  // ======================================

  socket.on(
    "disconnect",
    (reason) => {

      console.log(
        "User disconnected:",
        socket.id,
        "Reason:",
        reason
      );
    }
  );
});

// ========================================
// SERVER
// ========================================

const PORT =
  process.env.PORT || 5000;

server.listen(
  PORT,
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Uploads directory: ${uploadsPath}`
    );
  }
);
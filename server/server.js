require("dotenv").config();

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

// Create uploads folder if it doesn't exist
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
      // Allow requests without an origin
      // Example:
      // Postman
      // Server-to-server requests

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

// Upload API
//
// POST
// /api/files/upload

app.use(
  "/api/files",
  fileRoutes
);

// ========================================
// STATIC UPLOADED FILES
// ========================================
//
// Files stored inside:
//
// server/uploads/
//
// Can be accessed using:
//
// http://localhost:5000/uploads/filename.pdf
//
// Production:
//
// https://messenger-app-of9j.onrender.com/uploads/filename.pdf
//

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
      // Allow requests without an origin
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
        new Error("Not allowed by Socket.IO CORS")
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
// SOCKET CONNECTION
// ========================================

io.on("connection", (socket) => {
  console.log(
    "User connected:",
    socket.id
  );

  // ======================================
  // JOIN CHAT ROOM
  // ======================================

  socket.on(
    "join_room",
    (roomId) => {
      try {
        if (!roomId) {
          console.error(
            "join_room: roomId is missing"
          );

          return;
        }

        socket.join(roomId);

        console.log(
          `${socket.id} joined room: ${roomId}`
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
          "Message received:",
          data
        );

        // ==================================
        // VALIDATE ROOM
        // ==================================

        if (!data || !data.roomId) {
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
        // CREATE MESSAGE
        // ==================================

        const newMessage =
          new Message({
            roomId:
              data.roomId,

            senderId:
              data.senderId,

            senderUsername:
              data.username,

            receiverId:
              data.receiverId,

            message:
              data.message || "",

            file:
              data.file || null,
          });

        // ==================================
        // SAVE MESSAGE TO MONGODB
        // ==================================

        const savedMessage =
          await newMessage.save();

        console.log(
          "Message saved to MongoDB:",
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
            savedMessage.file || null,

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
          "Message save error:",
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
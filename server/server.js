require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

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
      // Allow requests with no origin
      // Example: Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

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
// API ROUTES
// ========================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/users",
  userRoutes
);

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
    origin: [
      "http://localhost:5173",
      "https://messenger-app-cyan-two.vercel.app",
    ],

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

      socket.join(roomId);

      console.log(
        `${socket.id} joined room: ${roomId}`
      );

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

        // ================================
        // SAVE MESSAGE
        // ================================

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
              data.message,
          });

        const savedMessage =
          await newMessage.save();

        console.log(
          "Message saved to MongoDB:",
          savedMessage._id
        );

        // ================================
        // SEND MESSAGE TO ROOM
        // ================================

        io
          .to(data.roomId)
          .emit(
            "receive_message",
            {
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

              timestamp:
                savedMessage.createdAt,
            }
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
    () => {

      console.log(
        "User disconnected:",
        socket.id
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

  }
);

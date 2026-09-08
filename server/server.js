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

  console.log("📁 Uploads folder created.");
}

// ========================================
// ALLOWED FRONTEND ORIGINS
// ========================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://messenger-app-cyan-two.vercel.app",
];

// ========================================
// CORS
// ========================================

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without Origin
      // Example: Postman / server-to-server
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        "❌ CORS blocked origin:",
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

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Session-ID",
    ],

    credentials: true,
  })
);

// ========================================
// BODY PARSER
// ========================================

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

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
    socket: "Socket.IO enabled",
  });
});

// ========================================
// SOCKET.IO
// ========================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },

  transports: [
    "polling",
    "websocket",
  ],

  // Ping configuration
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ========================================
// ONLINE USERS
// ========================================
//
// Structure:
//
// Map {
//   userId => Set(socketId)
// }
//
// Set is used because the same user can have
// multiple tabs/devices connected.
//
// ========================================

const onlineUsers = new Map();

// ========================================
// SOCKET -> USER MAP
// ========================================

const socketUsers = new Map();

// ========================================
// HELPER: ADD ONLINE USER
// ========================================

function addOnlineUser(userId, socketId) {
  const id = String(userId);

  if (!onlineUsers.has(id)) {
    onlineUsers.set(id, new Set());
  }

  onlineUsers
    .get(id)
    .add(socketId);

  socketUsers.set(
    socketId,
    id
  );
}

// ========================================
// HELPER: REMOVE ONLINE USER
// ========================================

function removeOnlineUser(socketId) {
  const userId =
    socketUsers.get(socketId);

  if (!userId) {
    return null;
  }

  // Remove socket mapping
  socketUsers.delete(socketId);

  const userSockets =
    onlineUsers.get(userId);

  if (userSockets) {
    userSockets.delete(socketId);

    // If user has no more active sockets,
    // user is actually offline.
    if (userSockets.size === 0) {
      onlineUsers.delete(userId);

      return {
        userId,
        becameOffline: true,
      };
    }
  }

  // User still has another tab/device open.
  return {
    userId,
    becameOffline: false,
  };
}

// ========================================
// HELPER: CHECK ONLINE STATUS
// ========================================

function isUserOnline(userId) {
  return onlineUsers.has(
    String(userId)
  );
}

// ========================================
// HELPER: GET ONLINE USERS
// ========================================

function getOnlineUsers() {
  return Array.from(
    onlineUsers.keys()
  );
}

// ========================================
// MONGODB CONNECTION
// ========================================

if (!process.env.MONGO_URI) {
  console.error(
    "❌ ERROR: MONGO_URI is not defined in .env"
  );
} else {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log(
        "✅ MongoDB Connected Successfully"
      );
    })
    .catch((error) => {
      console.error(
        "❌ MongoDB Connection Error:",
        error.message
      );
    });
}

// ========================================
// SOCKET AUTHENTICATION MIDDLEWARE
// ========================================

io.use(async (socket, next) => {
  try {
    const {
      token,
      sessionId,
      userId,
    } =
      socket.handshake.auth || {};

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

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    console.log(
      "🔐 Socket JWT verified"
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
        new Error(
          "Invalid user"
        )
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

      console.error(
        "JWT session:",
        decoded.sessionId
      );

      console.error(
        "Client session:",
        sessionId
      );

      return next(
        new Error(
          "Invalid session"
        )
      );
    }

    // ======================================
    // FIND USER
    // ======================================

    const user =
      await User.findById(userId);

    if (!user) {
      console.error(
        "❌ User not found:",
        userId
      );

      return next(
        new Error(
          "User not found"
        )
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

      console.error(
        "Database session:",
        user.sessionId
      );

      console.error(
        "Client session:",
        sessionId
      );

      return next(
        new Error(
          "Session invalid"
        )
      );
    }

    // ======================================
    // ATTACH TRUSTED USER DATA
    // ======================================

    socket.userId =
      user._id.toString();

    socket.sessionId =
      String(user.sessionId);

    socket.username =
      user.username;

    socket.user =
      user;

    console.log(
      "========================================"
    );

    console.log(
      "✅ SOCKET AUTHENTICATION SUCCESSFUL"
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

    console.log(
      "========================================"
    );

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

io.on(
  "connection",
  (socket) => {

    console.log(
      "========================================"
    );

    console.log(
      "🟢 AUTHENTICATED USER CONNECTED"
    );

    console.log(
      "Socket ID:",
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

    console.log(
      "========================================"
    );

    // ======================================
    // ADD USER TO ONLINE USERS
    // ======================================

    const wasAlreadyOnline =
      isUserOnline(
        socket.userId
      );

    addOnlineUser(
      socket.userId,
      socket.id
    );

    // ======================================
    // SEND CURRENT ONLINE USERS
    // ======================================

    socket.emit(
      "online_users",
      getOnlineUsers()
    );

    // ======================================
    // NOTIFY OTHER USERS
    // ======================================

    if (!wasAlreadyOnline) {
      socket.broadcast.emit(
        "user_online",
        {
          userId:
            socket.userId,

          username:
            socket.username,
        }
      );

      console.log(
        `🟢 ${socket.username} is ONLINE`
      );
    }

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
              "❌ join_room: roomId is missing"
            );

            return;
          }

          // ==================================
          // GET ROOM MEMBERS
          // ==================================

          const roomParts =
            String(roomId).split("_");

          // ==================================
          // VERIFY USER BELONGS TO ROOM
          // ==================================

          if (
            !roomParts.includes(
              String(
                socket.userId
              )
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

          socket.join(
            String(roomId)
          );

          console.log(
            `✅ ${socket.username} joined room: ${roomId}`
          );

        } catch (error) {

          console.error(
            "❌ Join room error:",
            error
          );
        }
      }
    );

    // ======================================
    // TYPING START
    // ======================================

    socket.on(
      "typing",
      ({
        roomId,
        userId,
        receiverId,
      }) => {

        try {

          if (
            !roomId ||
            !receiverId
          ) {
            return;
          }

          // ==================================
          // GET ROOM MEMBERS
          // ==================================

          const roomParts =
            String(roomId).split("_");

          // ==================================
          // VERIFY SENDER
          // ==================================

          if (
            !roomParts.includes(
              String(
                socket.userId
              )
            )
          ) {

            console.error(
              "❌ Unauthorized typing attempt:",
              roomId
            );

            return;
          }

          // ==================================
          // VERIFY SOCKET IS IN ROOM
          // ==================================

          if (
            !socket.rooms.has(
              String(roomId)
            )
          ) {

            console.error(
              "❌ Socket is not inside room:",
              roomId
            );

            return;
          }

          // ==================================
          // VERIFY RECEIVER
          // ==================================

          if (
            !roomParts.includes(
              String(receiverId)
            )
          ) {

            console.error(
              "❌ Invalid typing receiver:",
              receiverId
            );

            return;
          }

          // ==================================
          // PREVENT SELF TYPING
          // ==================================

          if (
            String(receiverId) ===
            String(socket.userId)
          ) {
            return;
          }

          // ==================================
          // SEND TYPING EVENT
          // ==================================

          socket
            .to(roomId)
            .emit(
              "user_typing",
              {
                roomId:

                  String(
                    roomId
                  ),

                userId:
                  String(
                    socket.userId
                  ),

                receiverId:
                  String(
                    receiverId
                  ),

                username:
                  socket.username,
              }
            );

          console.log(
            `⌨️ ${socket.username} is typing in ${roomId}`
          );

        } catch (error) {

          console.error(
            "❌ Typing event error:",
            error
          );
        }
      }
    );

    // ======================================
    // TYPING STOP
    // ======================================

    socket.on(
      "stop_typing",
      ({
        roomId,
        userId,
        receiverId,
      }) => {

        try {

          if (
            !roomId ||
            !receiverId
          ) {
            return;
          }

          // ==================================
          // GET ROOM MEMBERS
          // ==================================

          const roomParts =
            String(roomId).split("_");

          // ==================================
          // VERIFY SENDER
          // ==================================

          if (
            !roomParts.includes(
              String(
                socket.userId
              )
            )
          ) {

            console.error(
              "❌ Unauthorized stop typing attempt:",
              roomId
            );

            return;
          }

          // ==================================
          // VERIFY SOCKET IS IN ROOM
          // ==================================

          if (
            !socket.rooms.has(
              String(roomId)
            )
          ) {

            console.error(
              "❌ Socket is not inside room:",
              roomId
            );

            return;
          }

          // ==================================
          // VERIFY RECEIVER
          // ==================================

          if (
            !roomParts.includes(
              String(receiverId)
            )
          ) {

            console.error(
              "❌ Invalid stop typing receiver:",
              receiverId
            );

            return;
          }

          // ==================================
          // PREVENT SELF TYPING
          // ==================================

          if (
            String(receiverId) ===
            String(socket.userId)
          ) {
            return;
          }

          // ==================================
          // SEND STOP TYPING EVENT
          // ==================================

          socket
            .to(roomId)
            .emit(
              "user_stop_typing",
              {
                roomId:
                  String(
                    roomId
                  ),

                userId:
                  String(
                    socket.userId
                  ),

                receiverId:
                  String(
                    receiverId
                  ),
              }
            );

          console.log(
            `⌨️ ${socket.username} stopped typing`
          );

        } catch (error) {

          console.error(
            "❌ Stop typing event error:",
            error
          );
        }
      }
    );

    // ======================================
    // CHECK USER ONLINE STATUS
    // ======================================

    socket.on(
      "check_user_online",
      ({
        userId,
      }) => {

        try {

          if (!userId) {
            return;
          }

          socket.emit(
            "user_online_status",
            {
              userId:
                String(userId),

              online:
                isUserOnline(
                  userId
                ),
            }
          );

        } catch (error) {

          console.error(
            "❌ Online status check error:",
            error
          );
        }
      }
    );

    // ======================================
    // GET ALL ONLINE USERS
    // ======================================

    socket.on(
      "get_online_users",
      () => {

        socket.emit(
          "online_users",
          getOnlineUsers()
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
            String(
              data.roomId
            ).split("_");

          // ==================================
          // VERIFY SENDER
          // ==================================

          if (
            !roomParts.includes(
              String(
                socket.userId
              )
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
          // VERIFY SOCKET IS IN ROOM
          // ==================================

          if (
            !socket.rooms.has(
              String(
                data.roomId
              )
            )
          ) {

            console.error(
              "❌ Sender has not joined room:",
              data.roomId
            );

            socket.emit(
              "message_error",
              {
                message:
                  "You are not connected to this chat room.",
              }
            );

            return;
          }

          // ==================================
          // VALIDATE RECEIVER
          // ==================================

          if (
            !data.receiverId
          ) {

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
            String(
              data.receiverId
            );

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

              roomId:
                data.roomId,

              // IMPORTANT:
              // Always trust server user ID.

              senderId:
                socket.userId,

              senderUsername:
                socket.username,

              receiverId:
                receiverId,

              message:
                data.message || "",

              file:
                data.file || null,
            });

          // ==================================
          // SAVE MESSAGE
          // ==================================

          const savedMessage =
            await newMessage.save();

          console.log(
            "✅ Message saved to MongoDB:",
            savedMessage._id
          );

          // ==================================
          // PREPARE MESSAGE DATA
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

          // ==================================
          // AUTOMATICALLY STOP TYPING
          // ==================================

          socket
            .to(data.roomId)
            .emit(
              "user_stop_typing",
              {
                roomId:
                  String(
                    data.roomId
                  ),

                userId:
                  String(
                    socket.userId
                  ),

                receiverId:
                  String(
                    receiverId
                  ),
              }
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
          "🔌 Socket disconnected:",
          socket.id
        );

        console.log(
          "Reason:",
          reason
        );

        // ==================================
        // REMOVE USER SOCKET
        // ==================================

        const result =
          removeOnlineUser(
            socket.id
          );

        // ==================================
        // USER REALLY OFFLINE
        // ==================================

        if (
          result &&
          result.becameOffline
        ) {

          console.log(
            `🔴 ${socket.username} is OFFLINE`
          );

          // ==================================
          // NOTIFY ALL OTHER USERS
          // ==================================

          socket.broadcast.emit(
            "user_offline",
            {
              userId:
                result.userId,

              username:
                socket.username,
            }
          );
        }
      }
    );
  }
);

// ========================================
// SERVER START
// ========================================

const PORT =
  process.env.PORT || 5000;

server.listen(
  PORT,
  () => {

    console.log(
      "========================================"
    );

    console.log(
      `🚀 Server running on port ${PORT}`
    );

    console.log(
      `📁 Uploads directory: ${uploadsPath}`
    );

    console.log(
      "🔌 Socket.IO is enabled"
    );

    console.log(
      "🟢 Online/Offline status enabled"
    );

    console.log(
      "⌨️ Typing indicator enabled"
    );

    console.log(
      "========================================"
    );
  }
);

// ========================================
// GLOBAL ERROR HANDLING
// ========================================

process.on(
  "uncaughtException",
  (error) => {

    console.error(
      "❌ Uncaught Exception:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (error) => {

    console.error(
      "❌ Unhandled Rejection:",
      error
    );
  }
);
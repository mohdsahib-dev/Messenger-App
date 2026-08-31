const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // ========================================
    // CHAT ROOM
    // ========================================

    roomId: {
      type: String,
      required: true,
      index: true,
    },


    // ========================================
    // SENDER
    // ========================================

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    // ========================================
    // SENDER USERNAME
    // ========================================

    senderUsername: {
      type: String,
      required: true,
    },


    // ========================================
    // RECEIVER
    // ========================================

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    // ========================================
    // TEXT MESSAGE
    // ========================================

    message: {
      type: String,
      default: "",
      trim: true,
    },


    // ========================================
    // FILE
    // ========================================

    file: {

      originalName: {
        type: String,
        default: null,
      },

      fileName: {
        type: String,
        default: null,
      },

      fileType: {
        type: String,
        default: null,
      },

      fileSize: {
        type: Number,
        default: null,
      },

      fileUrl: {
        type: String,
        default: null,
      },

    },

  },

  {
    timestamps: true,
  }
);


module.exports = mongoose.model(
  "Message",
  messageSchema
);

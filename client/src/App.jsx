import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

function App() {
  // ========================================
  // AUTH
  // ========================================

  const [isLogin, setIsLogin] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const token = sessionStorage.getItem("token");
    const user = sessionStorage.getItem("user");
    const sessionId = sessionStorage.getItem("sessionId");

    return !!(token && user && sessionId);
  });

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  // ========================================
  // USERS
  // ========================================

  const [users, setUsers] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  // ========================================
  // ONLINE USERS
  // ========================================

  // Contains IDs of users who currently have
  // an authenticated Socket.IO connection.
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // ========================================
  // FILTER USERS
  // ========================================

  const filteredUsers = users.filter((user) => {
    const search = searchText.toLowerCase().trim();

    if (!search) {
      return true;
    }

    return (
      user.username?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search)
    );
  });

  // ========================================
  // CHAT
  // ========================================

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  // ========================================
  // TYPING INDICATOR
  // ========================================

  const [isTyping, setIsTyping] = useState(false);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // ========================================
  // FILE UPLOAD
  // ========================================

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  // ========================================
  // SOCKET
  // ========================================

  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);

  // ========================================
  // BACKEND URL
  // ========================================

  const API_URL = "https://messenger-app-of9j.onrender.com";

  // ========================================
  // CURRENT USER
  // ========================================

  const getCurrentUser = () => {
    try {
      return JSON.parse(sessionStorage.getItem("user"));
    } catch {
      return null;
    }
  };

  // ========================================
  // GET SESSION ID
  // ========================================

  const getSessionId = () => {
    return sessionStorage.getItem("sessionId");
  };

  // ========================================
  // CREATE ROOM ID
  // ========================================

  const createRoomId = (user1, user2) => {
    return [String(user1), String(user2)]
      .sort()
      .join("_");
  };

  // ========================================
  // CHECK USER ONLINE
  // ========================================

  const isUserOnline = (user) => {
    if (!user) {
      return false;
    }

    const userId = user._id || user.id;

    if (!userId) {
      return false;
    }

    return onlineUsers.has(String(userId));
  };

  // ========================================
  // STOP LOCAL TYPING
  // ========================================

  const stopTyping = () => {
    const socket = socketRef.current;
    const selectedUser = selectedUserRef.current;
    const currentUser = getCurrentUser();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (
      socket &&
      socket.connected &&
      selectedUser &&
      currentUser
    ) {
      const currentUserId =
        currentUser._id || currentUser.id;

      const selectedUserId =
        selectedUser._id || selectedUser.id;

      if (currentUserId && selectedUserId) {
        const roomId = createRoomId(
          currentUserId,
          selectedUserId
        );

        if (isTypingRef.current) {
          socket.emit("stop_typing", {
            roomId,
            userId: currentUserId,
            receiverId: selectedUserId,
          });
        }
      }
    }

    isTypingRef.current = false;
    setIsTyping(false);
  };

  // ========================================
  // HANDLE LOCAL TYPING
  // ========================================

  const handleTyping = (value) => {
    setText(value);

    const socket = socketRef.current;
    const currentUser = getCurrentUser();
    const selectedUser = selectedUserRef.current;

    if (
      !socket ||
      !socket.connected ||
      !currentUser ||
      !selectedUser
    ) {
      return;
    }

    const currentUserId =
      currentUser._id || currentUser.id;

    const selectedUserId =
      selectedUser._id || selectedUser.id;

    if (!currentUserId || !selectedUserId) {
      return;
    }

    const roomId = createRoomId(
      currentUserId,
      selectedUserId
    );

    // Empty input means typing stopped.
    if (!value.trim()) {
      stopTyping();
      return;
    }

    // Send typing event only once.
    if (!isTypingRef.current) {
      socket.emit("typing", {
        roomId,
        userId: currentUserId,
        receiverId: selectedUserId,
      });

      isTypingRef.current = true;
    }

    // Reset timeout whenever another key is pressed.
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (
        socket &&
        socket.connected
      ) {
        socket.emit("stop_typing", {
          roomId,
          userId: currentUserId,
          receiverId: selectedUserId,
        });
      }

      isTypingRef.current = false;
      typingTimeoutRef.current = null;
    }, 1500);
  };

  // ========================================
  // SOCKET CONNECTION
  // ========================================

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    // ======================================
    // CHECK SESSION
    // ======================================

    const token = sessionStorage.getItem("token");
    const sessionId = getSessionId();

    if (!token || !sessionId) {
      console.error(
        "❌ Authentication session missing"
      );

      return;
    }

    // ======================================
    // CURRENT USER
    // ======================================

    const currentUser = getCurrentUser();

    const userId =
      currentUser?._id ||
      currentUser?.id;

    if (!userId) {
      console.error(
        "❌ User ID missing"
      );

      return;
    }

    console.log(
      "🔌 Connecting Socket.IO..."
    );

    // ======================================
    // CREATE SOCKET
    // ======================================

    const newSocket = io(
      API_URL,
      {
        transports: [
          "polling",
          "websocket",
        ],

        auth: {
          token,
          sessionId,
          userId,
        },
      }
    );

    socketRef.current = newSocket;

    // ======================================
    // SOCKET CONNECTED
    // ======================================

    newSocket.on(
      "connect",
      () => {
        console.log(
          "✅ Socket connected:",
          newSocket.id
        );

        const currentUser =
          getCurrentUser();

        const selectedUser =
          selectedUserRef.current;

        // ------------------------------------
        // CURRENT USER IS ONLINE
        // ------------------------------------

        const currentUserId =
          currentUser?._id ||
          currentUser?.id;

        if (currentUserId) {
          setOnlineUsers((prev) => {
            const next = new Set(prev);

            next.add(
              String(currentUserId)
            );

            return next;
          });
        }

        // ------------------------------------
        // REJOIN CURRENT ROOM
        // ------------------------------------

        if (
          currentUser &&
          selectedUser
        ) {
          const currentUserId =
            currentUser._id ||
            currentUser.id;

          const selectedUserId =
            selectedUser._id ||
            selectedUser.id;

          if (
            currentUserId &&
            selectedUserId
          ) {
            const roomId =
              createRoomId(
                currentUserId,
                selectedUserId
              );

            console.log(
              "🔄 Rejoining room:",
              roomId
            );

            newSocket.emit(
              "join_room",
              roomId
            );
          }
        }
      }
    );

    // ======================================
    // ONLINE USERS INITIAL LIST
    // ======================================

    newSocket.on(
      "online_users",
      (userIds) => {
        if (!Array.isArray(userIds)) {
          return;
        }

        setOnlineUsers(
          new Set(
            userIds.map((id) =>
              String(id)
            )
          )
        );
      }
    );

    // ======================================
    // USER ONLINE / OFFLINE
    // ======================================

    newSocket.on(
      "user_status",
      ({
        userId,
        status,
      }) => {
        if (!userId) {
          return;
        }

        const normalizedId =
          String(userId);

        setOnlineUsers((prev) => {
          const next = new Set(prev);

          if (status === "online") {
            next.add(normalizedId);
          }

          if (status === "offline") {
            next.delete(normalizedId);
          }

          return next;
        });
      }
    );

    // ======================================
    // SOCKET CONNECT ERROR
    // ======================================

    newSocket.on(
      "connect_error",
      (error) => {
        console.error(
          "❌ SOCKET CONNECTION ERROR"
        );

        console.error(
          "Message:",
          error.message
        );

        console.error(
          "Description:",
          error.description
        );

        console.error(
          "Context:",
          error.context
        );
      }
    );

    // ======================================
    // USER TYPING
    // ======================================

    newSocket.on(
      "user_typing",
      ({
        userId,
        roomId,
      }) => {
        const currentUser =
          getCurrentUser();

        const selectedUser =
          selectedUserRef.current;

        if (
          !currentUser ||
          !selectedUser
        ) {
          return;
        }

        const currentUserId =
          currentUser._id ||
          currentUser.id;

        const selectedUserId =
          selectedUser._id ||
          selectedUser.id;

        const currentRoomId =
          createRoomId(
            currentUserId,
            selectedUserId
          );

        if (
          String(roomId) ===
            String(currentRoomId) &&
          String(userId) ===
            String(selectedUserId)
        ) {
          setIsTyping(true);
        }
      }
    );

    // ======================================
    // USER STOPPED TYPING
    // ======================================

    newSocket.on(
      "user_stop_typing",
      ({
        userId,
        roomId,
      }) => {
        const currentUser =
          getCurrentUser();

        const selectedUser =
          selectedUserRef.current;

        if (
          !currentUser ||
          !selectedUser
        ) {
          return;
        }

        const currentUserId =
          currentUser._id ||
          currentUser.id;

        const selectedUserId =
          selectedUser._id ||
          selectedUser.id;

        const currentRoomId =
          createRoomId(
            currentUserId,
            selectedUserId
          );

        if (
          String(roomId) ===
            String(currentRoomId) &&
          String(userId) ===
            String(selectedUserId)
        ) {
          setIsTyping(false);
        }
      }
    );

    // ======================================
    // RECEIVE MESSAGE
    // ======================================

    newSocket.on(
      "receive_message",
      (data) => {
        console.log(
          "📩 Received message:",
          data
        );

        const currentUser =
          getCurrentUser();

        const selectedUser =
          selectedUserRef.current;

        if (
          !currentUser ||
          !selectedUser
        ) {
          return;
        }

        const currentUserId =
          currentUser._id ||
          currentUser.id;

        const selectedUserId =
          selectedUser._id ||
          selectedUser.id;

        const currentRoomId =
          createRoomId(
            currentUserId,
            selectedUserId
          );

        // ==================================
        // IGNORE OTHER ROOM
        // ==================================

        if (
          String(data.roomId) !==
          String(currentRoomId)
        ) {
          console.log(
            "Ignoring message from another room:",
            data.roomId
          );

          return;
        }

        // ==================================
        // FORMAT MESSAGE
        // ==================================

        const formattedMessage = {
          _id: data._id,

          roomId: data.roomId,

          senderId: data.senderId,

          receiverId: data.receiverId,

          username: data.username,

          text: data.message || "",

          file: data.file || null,

          time: new Date(
            data.timestamp
          ).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),
        };

        // ==================================
        // ADD MESSAGE
        // ==================================

        setMessages((prev) => {
          if (
            prev.some(
              (msg) =>
                String(msg._id) ===
                String(
                  formattedMessage._id
                )
            )
          ) {
            return prev;
          }

          return [
            ...prev,
            formattedMessage,
          ];
        });
      }
    );

    // ======================================
    // MESSAGE ERROR
    // ======================================

    newSocket.on(
      "message_error",
      (data) => {
        console.error(
          "❌ Message error:",
          data.message
        );

        alert(
          data.message ||
            "Message could not be sent."
        );
      }
    );

    // ======================================
    // DISCONNECT
    // ======================================

    newSocket.on(
      "disconnect",
      (reason) => {
        console.log(
          "❌ Socket disconnected:",
          reason
        );

        // Do NOT manually remove current user here.
        // Server will broadcast offline status only
        // when the user's last active socket disconnects.
      }
    );

    // ======================================
    // CLEANUP
    // ======================================

    return () => {
      console.log(
        "🔌 Cleaning Socket.IO connection..."
      );

      if (typingTimeoutRef.current) {
        clearTimeout(
          typingTimeoutRef.current
        );

        typingTimeoutRef.current =
          null;
      }

      isTypingRef.current = false;
      setIsTyping(false);

      newSocket.disconnect();

      socketRef.current = null;
    };
  }, [isLoggedIn]);

  // ========================================
  // FETCH USERS
  // ========================================

  useEffect(() => {
    const fetchUsers = async () => {
      const currentUser =
        getCurrentUser();

      if (!currentUser) {
        return;
      }

      const currentUserId =
        currentUser._id ||
        currentUser.id;

      if (!currentUserId) {
        console.error(
          "❌ Current user ID not found"
        );

        return;
      }

      const token =
        sessionStorage.getItem("token");

      const sessionId =
        getSessionId();

      if (!token || !sessionId) {
        console.error(
          "❌ Authentication session missing"
        );

        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/users/${currentUserId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,

                "X-Session-ID":
                  sessionId,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          console.error(
            data.message
          );

          return;
        }

        if (data.success) {
          setUsers(
            data.users
          );
        }
      } catch (error) {
        console.error(
          "❌ Failed to fetch users:",
          error
        );
      }
    };

    if (isLoggedIn) {
      fetchUsers();
    }
  }, [isLoggedIn]);

  // ========================================
  // LOGIN / REGISTER
  // ========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");

    const endpoint =
      isLogin
        ? `${API_URL}/api/auth/login`
        : `${API_URL}/api/auth/register`;

    const body =
      isLogin
        ? {
            email,
            password,
          }
        : {
            username,
            email,
            password,
          };

    try {
      const response =
        await fetch(
          endpoint,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(body),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Something went wrong"
        );

        return;
      }

      if (!data.sessionId) {
        console.error(
          "❌ Server did not return session ID"
        );

        setMessage(
          "Server did not return a session ID"
        );

        return;
      }

      sessionStorage.setItem(
        "token",
        data.token
      );

      sessionStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      sessionStorage.setItem(
        "sessionId",
        data.sessionId
      );

      console.log(
        "✅ Server session ID:",
        data.sessionId
      );

      setMessage(
        data.message ||
          "Authentication successful"
      );

      setPassword("");

      setIsLoggedIn(true);
    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      setMessage(
        "Cannot connect to server"
      );
    }
  };

  // ========================================
  // LOGOUT
  // ========================================

  const logout = () => {
    stopTyping();

    sessionStorage.removeItem(
      "token"
    );

    sessionStorage.removeItem(
      "user"
    );

    sessionStorage.removeItem(
      "sessionId"
    );

    if (socketRef.current) {
      socketRef.current.disconnect();

      socketRef.current = null;
    }

    setIsLoggedIn(false);

    setSelectedUser(null);

    selectedUserRef.current = null;

    setMessages([]);

    setUsers([]);

    setOnlineUsers(new Set());

    setText("");

    setSelectedFile(null);

    setUploading(false);
  };

  // ========================================
  // SELECT USER
  // ========================================

  const selectUser = async (user) => {
    stopTyping();

    setSelectedUser(user);

    selectedUserRef.current = user;

    setIsTyping(false);

    setMessages([]);

    const currentUser =
      getCurrentUser();

    if (!currentUser) {
      console.error(
        "❌ Current user not found"
      );

      return;
    }

    const currentUserId =
      currentUser._id ||
      currentUser.id;

    const selectedUserId =
      user._id ||
      user.id;

    if (
      !currentUserId ||
      !selectedUserId
    ) {
      console.error(
        "❌ User ID missing"
      );

      return;
    }

    const roomId =
      createRoomId(
        currentUserId,
        selectedUserId
      );

    console.log(
      "🏠 Room ID:",
      roomId
    );

    const token =
      sessionStorage.getItem("token");

    const sessionId =
      getSessionId();

    if (!token || !sessionId) {
      console.error(
        "❌ Session authentication missing"
      );

      logout();

      return;
    }

    const socket =
      socketRef.current;

    if (
      !socket ||
      !socket.connected
    ) {
      console.error(
        "❌ Socket not connected"
      );

      return;
    }

    socket.emit(
      "join_room",
      roomId
    );

    try {
      const response =
        await fetch(
          `${API_URL}/api/messages/${roomId}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,

              "X-Session-ID":
                sessionId,
            },
          }
        );

      const data =
        await response.json();

      if (data.success) {
        const formattedMessages =
          data.messages.map(
            (msg) => ({
              _id:
                msg._id,

              roomId:
                msg.roomId,

              senderId:
                msg.senderId,

              receiverId:
                msg.receiverId,

              username:
                msg.senderUsername,

              text:
                msg.message ||
                "",

              file:
                msg.file ||
                null,

              time:
                new Date(
                  msg.createdAt
                ).toLocaleTimeString(
                  [],
                  {
                    hour:
                      "2-digit",

                    minute:
                      "2-digit",
                  }
                ),
            })
          );

        setMessages(
          formattedMessages
        );
      }
    } catch (error) {
      console.error(
        "❌ Failed to load chat history:",
        error
      );
    }
  };

  // ========================================
  // SELECT FILE
  // ========================================

  const handleFileSelect = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    const maxSize =
      20 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        "File size must be less than 20 MB."
      );

      e.target.value = "";

      return;
    }

    setSelectedFile(file);

    console.log(
      "📎 Selected file:",
      file.name
    );
  };

  // ========================================
  // OPEN FILE SELECTOR
  // ========================================

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // ========================================
  // REMOVE SELECTED FILE
  // ========================================

  const removeSelectedFile = () => {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  // ========================================
  // UPLOAD FILE
  // ========================================

  const uploadFile = async (file) => {
    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      console.log(
        "📤 Uploading file:",
        file.name
      );

      const token =
        sessionStorage.getItem("token");

      const sessionId =
        getSessionId();

      if (!token || !sessionId) {
        throw new Error(
          "Authentication session expired."
        );
      }

      const response =
        await fetch(
          `${API_URL}/api/files/upload`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "X-Session-ID":
                sessionId,
            },

            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "File upload failed"
        );
      }

      console.log(
        "✅ File uploaded:",
        data.file
      );

      return data.file;
    } catch (error) {
      console.error(
        "❌ File upload error:",
        error
      );

      throw error;
    }
  };

  // ========================================
  // DOWNLOAD FILE
  // ========================================

  const downloadFile = async (file) => {
    try {
      if (
        !file ||
        !file.fileUrl
      ) {
        throw new Error(
          "File URL not found"
        );
      }

      const token =
        sessionStorage.getItem("token");

      const sessionId =
        getSessionId();

      if (!token || !sessionId) {
        throw new Error(
          "Authentication session expired."
        );
      }

      const fileUrl =
        `${API_URL}${file.fileUrl}`;

      console.log(
        "⬇️ Downloading:",
        fileUrl
      );

      const response =
        await fetch(
          fileUrl,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,

              "X-Session-ID":
                sessionId,
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          "File download failed"
        );
      }

      const blob =
        await response.blob();

      const blobUrl =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = blobUrl;

      link.download =
        file.originalName ||
        "download";

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      window.URL.revokeObjectURL(
        blobUrl
      );
    } catch (error) {
      console.error(
        "❌ File download error:",
        error
      );

      alert(
        error.message ||
          "Unable to download file."
      );
    }
  };

  // ========================================
  // SEND MESSAGE
  // ========================================

  const sendMessage = async () => {
    stopTyping();

    if (!selectedUser) {
      console.error(
        "❌ No user selected"
      );

      return;
    }

    if (
      !text.trim() &&
      !selectedFile
    ) {
      return;
    }

    const socket =
      socketRef.current;

    if (
      !socket ||
      !socket.connected
    ) {
      console.error(
        "❌ Socket not connected"
      );

      alert(
        "Connection to server lost. Please try again."
      );

      return;
    }

    const token =
      sessionStorage.getItem("token");

    const sessionId =
      getSessionId();

    if (!token || !sessionId) {
      console.error(
        "❌ Session expired"
      );

      logout();

      return;
    }

    const currentUser =
      getCurrentUser();

    if (!currentUser) {
      console.error(
        "❌ Current user not found"
      );

      return;
    }

    const currentUserId =
      currentUser._id ||
      currentUser.id;

    const selectedUserId =
      selectedUser._id ||
      selectedUser.id;

    const roomId =
      createRoomId(
        currentUserId,
        selectedUserId
      );

    let uploadedFile = null;

    if (selectedFile) {
      try {
        setUploading(true);

        uploadedFile =
          await uploadFile(
            selectedFile
          );
      } catch (error) {
        console.error(
          "❌ Could not upload file:",
          error
        );

        alert(
          error.message ||
            "File upload failed."
        );

        setUploading(false);

        return;
      }

      setUploading(false);
    }

    console.log(
      "📤 Sending message:",
      {
        roomId,
        receiverId:
          selectedUserId,
        message:
          text.trim(),
        file:
          uploadedFile,
      }
    );

    socket.emit(
      "send_message",
      {
        roomId,

        senderId:
          currentUserId,

        receiverId:
          selectedUserId,

        message:
          text.trim(),

        file:
          uploadedFile,

        sessionId,
      }
    );

    setText("");

    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  // ========================================
  // ENTER KEY
  // ========================================

  const handleMessageKeyDown = (e) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      sendMessage();
    }
  };

  // ========================================
  // FILE SIZE FORMAT
  // ========================================

  const formatFileSize = (bytes) => {
    if (!bytes) {
      return "";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (
      bytes <
      1024 * 1024
    ) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  };

  // ========================================
  // FILE ICON
  // ========================================

  const getFileIcon = (fileType) => {
    if (
      fileType?.startsWith(
        "image/"
      )
    ) {
      return "🖼️";
    }

    if (
      fileType ===
      "application/pdf"
    ) {
      return "📕";
    }

    if (
      fileType?.includes(
        "spreadsheet"
      ) ||
      fileType?.includes(
        "excel"
      ) ||
      fileType?.includes(
        "csv"
      )
    ) {
      return "📊";
    }

    if (
      fileType?.includes(
        "word"
      )
    ) {
      return "📘";
    }

    if (
      fileType?.includes(
        "zip"
      ) ||
      fileType?.includes(
        "compressed"
      )
    ) {
      return "🗜️";
    }

    return "📄";
  };

  // ========================================
  // AUTH PAGE
  // ========================================

  if (!isLoggedIn) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="logo">
            💬
          </div>

          <h1>
            Messenger
          </h1>

          <p className="subtitle">
            {isLogin
              ? "Welcome back!"
              : "Create your messenger account"}
          </p>

          <form
            onSubmit={
              handleSubmit
            }
          >
            {!isLogin && (
              <input
                type="text"
                placeholder="Username"
                value={
                  username
                }
                onChange={(e) =>
                  setUsername(
                    e.target.value
                  )
                }
                required
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={
                email
              }
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={
                password
              }
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
            />

            <button
              type="submit"
            >
              {isLogin
                ? "Login"
                : "Create Account"}
            </button>
          </form>

          {message && (
            <p className="auth-message">
              {message}
            </p>
          )}

          <div className="switch-auth">
            {isLogin ? (
              <>
                Don't have an
                account?{" "}

                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setMessage("");
                  }}
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an
                account?{" "}

                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setMessage("");
                  }}
                >
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // MESSENGER
  // ========================================

  return (
    <div className="messenger">

      {/* ==================================
          SIDEBAR
      ================================== */}

      <aside className="sidebar">

        <div className="sidebar-header">
          <h2>
            Messenger
          </h2>

          <button
            className="logout"
            onClick={
              logout
            }
          >
            Logout
          </button>
        </div>

        <input
          className="search"
          type="text"
          placeholder="Search users..."
          value={
            searchText
          }
          onChange={(e) =>
            setSearchText(
              e.target.value
            )
          }
        />

        <div className="user-list">

          {users.length === 0 ? (
            <div
              style={{
                padding:
                  "20px",
                textAlign:
                  "center",
                color:
                  "#777",
              }}
            >
              No other users
              found.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div
              style={{
                padding:
                  "20px",
                textAlign:
                  "center",
                color:
                  "#777",
              }}
            >
              No users found
            </div>
          ) : (
            filteredUsers.map(
              (user) => {
                const userId =
                  user._id ||
                  user.id;

                const selectedId =
                  selectedUser?._id ||
                  selectedUser?.id;

                const userOnline =
                  isUserOnline(
                    user
                  );

                return (
                  <div
                    key={
                      userId
                    }
                    className={`user ${
                      String(
                        selectedId
                      ) ===
                      String(
                        userId
                      )
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      selectUser(
                        user
                      )
                    }
                  >

                    <div className="avatar">
                      {user.username
                        ?.charAt(
                          0
                        )
                        .toUpperCase()}
                    </div>

                    <div className="user-info">

                      <div className="user-name">

                        {
                          user.username
                        }

                        <span
                          className={`online-dot ${
                            userOnline
                              ? "online"
                              : "offline"
                          }`}
                        ></span>

                      </div>

                      <div
                        className={`last-message ${
                          userOnline
                            ? "user-online-text"
                            : "user-offline-text"
                        }`}
                      >
                        {userOnline
                          ? "Online"
                          : "Offline"}
                      </div>

                    </div>
                  </div>
                );
              }
            )
          )}
        </div>
      </aside>

      {/* ==================================
          CHAT
      ================================== */}

      <main className="chat">

        {!selectedUser ? (
          <div className="empty-chat">

            <div className="empty-icon">
              💬
            </div>

            <h2>
              Welcome to
              Messenger
            </h2>

            <p>
              Select a user
              to start
              chatting.
            </p>

          </div>
        ) : (
          <>
            {/* ==============================
                CHAT HEADER
            ============================== */}

            <header className="chat-header">

              <div className="avatar">
                {selectedUser
                  .username
                  ?.charAt(
                    0
                  )
                  .toUpperCase()}
              </div>

              <div className="chat-user-details">

                <h3>
                  {
                    selectedUser.username
                  }
                </h3>

                {/* IMPORTANT:
                    typing replaces online/offline
                    so they never overlap.
                */}

                {isTyping ? (
                  <span className="typing-status">
                    typing...
                  </span>
                ) : (
                  <span
                    className={`presence-status ${
                      isUserOnline(
                        selectedUser
                      )
                        ? "online-status"
                        : "offline-status"
                    }`}
                  >
                    {isUserOnline(
                      selectedUser
                    )
                      ? "Online"
                      : "Offline"}
                  </span>
                )}

              </div>
            </header>

            {/* ==============================
                MESSAGES
            ============================== */}

            <div className="messages">

              {messages.length ===
                0 && (
                <div className="no-messages">
                  No messages
                  yet. Say
                  hello 👋
                </div>
              )}

              {messages.map(
                (msg) => {
                  const currentUser =
                    getCurrentUser();

                  const currentUserId =
                    currentUser?._id ||
                    currentUser?.id;

                  const isMine =
                    String(
                      msg.senderId
                    ) ===
                    String(
                      currentUserId
                    );

                  return (
                    <div
                      key={
                        String(
                          msg._id
                        )
                      }
                      className={`message-row ${
                        isMine
                          ? "my-message"
                          : "their-message"
                      }`}
                    >

                      <div className="message">

                        {msg.text && (
                          <p>
                            {
                              msg.text
                            }
                          </p>
                        )}

                        {msg.file && (
                          <div className="file-message">

                            {msg.file.fileType?.startsWith(
                              "image/"
                            ) ? (
                              <div className="image-file-preview">

                                <img
                                  src={
                                    `${API_URL}${msg.file.fileUrl}`
                                  }
                                  alt={
                                    msg.file.originalName ||
                                    "Image"
                                  }
                                  className="chat-image"
                                />

                              </div>
                            ) : (
                              <div className="file-info">

                                <div className="file-icon">
                                  {
                                    getFileIcon(
                                      msg.file.fileType
                                    )
                                  }
                                </div>

                                <div className="file-details">

                                  <strong>
                                    {
                                      msg.file.originalName ||
                                      "File"
                                    }
                                  </strong>

                                  <small>
                                    {
                                      formatFileSize(
                                        msg.file.fileSize
                                      )
                                    }
                                  </small>

                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              className="download-btn"
                              onClick={() =>
                                downloadFile(
                                  msg.file
                                )
                              }
                              title="Download"
                              aria-label="Download file"
                            >
                              <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M12 3V15"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />

                                <path
                                  d="M7 10L12 15L17 10"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />

                                <path
                                  d="M5 21H19"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>

                          </div>
                        )}

                        <span>
                          {
                            msg.time
                          }
                        </span>

                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* ==============================
                SELECTED FILE PREVIEW
            ============================== */}

            {selectedFile && (
              <div className="selected-file">

                <div className="selected-file-info">

                  <span className="selected-file-icon">
                    {
                      getFileIcon(
                        selectedFile.type
                      )
                    }
                  </span>

                  <div>
                    <strong>
                      {
                        selectedFile.name
                      }
                    </strong>

                    <small>
                      {
                        formatFileSize(
                          selectedFile.size
                        )
                      }
                    </small>
                  </div>

                </div>

                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={
                    removeSelectedFile
                  }
                  disabled={
                    uploading
                  }
                >
                  ×
                </button>

              </div>
            )}

            {/* ==============================
                INPUT
            ============================== */}

            <div className="message-input">

              <input
                ref={
                  fileInputRef
                }
                type="file"
                onChange={
                  handleFileSelect
                }
                style={{
                  display:
                    "none",
                }}
              />

              <button
                type="button"
                className="file-upload-btn"
                onClick={
                  handleFileClick
                }
                disabled={
                  uploading
                }
                title="Attach file"
              >
                +
              </button>

              <input
                type="text"
                placeholder={
                  selectedFile
                    ? "Add a message (optional)..."
                    : "Type a message..."
                }
                value={
                  text
                }
                onChange={(e) =>
                  handleTyping(
                    e.target.value
                  )
                }
                onKeyDown={
                  handleMessageKeyDown
                }
                disabled={
                  uploading
                }
              />

              <button
                onClick={
                  sendMessage
                }
                disabled={
                  uploading ||
                  (
                    !text.trim() &&
                    !selectedFile
                  )
                }
              >
                {uploading
                  ? "Uploading..."
                  : "Send"}
              </button>

            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
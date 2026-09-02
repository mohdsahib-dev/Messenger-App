import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

function App() {

  // ========================================
  // AUTH
  // ========================================

  const [isLogin, setIsLogin] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {

    const token =
      sessionStorage.getItem("token");

    const user =
      sessionStorage.getItem("user");

    return !!(
      token &&
      user
    );

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

  const API_URL =
    "https://messenger-app-of9j.onrender.com";


  // ========================================
  // CURRENT USER
  // ========================================

  const getCurrentUser = () => {

    try {

      return JSON.parse(
        sessionStorage.getItem("user")
      );

    } catch {

      return null;

    }

  };


  // ========================================
  // GET / CREATE SESSION ID
  // ========================================

  const getSessionId = () => {

    let sessionId =
      sessionStorage.getItem("sessionId");

    if (!sessionId) {

      sessionId =
        crypto.randomUUID();

      sessionStorage.setItem(
        "sessionId",
        sessionId
      );

    }

    return sessionId;

  };


  // ========================================
  // CREATE ROOM ID
  // ========================================

  const createRoomId = (user1, user2) => {

    return [
      String(user1),
      String(user2),
    ]
      .sort()
      .join("_");

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


    console.log(
      "🔌 Connecting Socket.IO..."
    );


    // ======================================
    // CREATE SOCKET
    // ======================================

    const newSocket =
      io(
        API_URL,
        {

          transports: [
            "websocket",
            "polling",
          ],

          auth: {

            token,

            sessionId,

          },

        }
      );


    socketRef.current =
      newSocket;


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
    // SOCKET CONNECT ERROR
    // ======================================

    newSocket.on(
      "connect_error",
      (error) => {

        console.error(
          "❌ Socket connection error:",
          error.message
        );

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


        // ==================================
        // CURRENT CHAT ROOM
        // ==================================

        const currentRoomId =
          createRoomId(
            currentUserId,
            selectedUserId
          );


        // ==================================
        // IGNORE OTHER CHAT MESSAGES
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

          _id:
            data._id,

          roomId:
            data.roomId,

          senderId:
            data.senderId,

          receiverId:
            data.receiverId,

          username:
            data.username,

          text:
            data.message || "",

          file:
            data.file || null,

          time:
            new Date(
              data.timestamp
            ).toLocaleTimeString(
              [],
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit",
              }
            ),

        };


        // ==================================
        // ADD MESSAGE
        // ==================================

        setMessages(
          (prev) => {

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

          }
        );

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

      }
    );


    // ======================================
    // CLEANUP
    // ======================================

    return () => {

      console.log(
        "🔌 Cleaning Socket.IO connection..."
      );


      newSocket.disconnect();

      socketRef.current =
        null;

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


    // ======================================
    // CREATE UNIQUE SESSION FOR THIS LOGIN
    // ======================================

    const sessionId =
      crypto.randomUUID();


    // ======================================
    // API ENDPOINT
    // ======================================

    const endpoint =
      isLogin
        ? `${API_URL}/api/auth/login`
        : `${API_URL}/api/auth/register`;


    // ======================================
    // REQUEST BODY
    // ======================================

    const body =
      isLogin
        ? {

            email,

            password,

            sessionId,

          }
        : {

            username,

            email,

            password,

            sessionId,

          };


    try {

      const response =
        await fetch(
          endpoint,
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

            },

            body:
              JSON.stringify(
                body
              ),

          }
        );


      const data =
        await response.json();


      // ====================================
      // ERROR
      // ====================================

      if (!response.ok) {

        setMessage(
          data.message ||
          "Something went wrong"
        );

        return;

      }


      // ====================================
      // SAVE SESSION
      // ====================================

      sessionStorage.setItem(
        "token",
        data.token
      );


      sessionStorage.setItem(
        "user",
        JSON.stringify(
          data.user
        )
      );


      sessionStorage.setItem(
        "sessionId",
        sessionId
      );


      // ====================================
      // SUCCESS
      // ====================================

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

    // ======================================
    // REMOVE SESSION
    // ======================================

    sessionStorage.removeItem(
      "token"
    );

    sessionStorage.removeItem(
      "user"
    );

    sessionStorage.removeItem(
      "sessionId"
    );


    // ======================================
    // DISCONNECT SOCKET
    // ======================================

    if (socketRef.current) {

      socketRef.current.disconnect();

      socketRef.current =
        null;

    }


    // ======================================
    // RESET APPLICATION
    // ======================================

    setIsLoggedIn(false);

    setSelectedUser(null);

    selectedUserRef.current =
      null;

    setMessages([]);

    setUsers([]);

    setText("");

    setSelectedFile(null);

    setUploading(false);

  };


  // ========================================
  // SELECT USER
  // ========================================

  const selectUser = async (user) => {

    setSelectedUser(user);

    selectedUserRef.current =
      user;

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


    // ======================================
    // CREATE ROOM
    // ======================================

    const roomId =
      createRoomId(
        currentUserId,
        selectedUserId
      );


    console.log(
      "🏠 Room ID:",
      roomId
    );


    // ======================================
    // CHECK AUTH SESSION
    // ======================================

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


    // ======================================
    // SOCKET
    // ======================================

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


    // ======================================
    // JOIN ROOM
    // ======================================

    socket.emit(
      "join_room",
      roomId
    );


    // ======================================
    // LOAD OLD MESSAGES
    // ======================================

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


      if (
        data.success
      ) {

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


    // ======================================
    // MAX FILE SIZE = 20 MB
    // ======================================

    const maxSize =
      20 * 1024 * 1024;


    if (file.size > maxSize) {

      alert(
        "File size must be less than 20 MB."
      );

      e.target.value =
        "";

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

    if (
      fileInputRef.current
    ) {

      fileInputRef.current.click();

    }

  };


  // ========================================
  // REMOVE SELECTED FILE
  // ========================================

  const removeSelectedFile = () => {

    setSelectedFile(null);


    if (
      fileInputRef.current
    ) {

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

            method:
              "POST",

            headers: {

              Authorization:
                `Bearer ${token}`,

              "X-Session-ID":
                sessionId,

            },

            body:
              formData,

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


      link.href =
        blobUrl;


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

    // ======================================
    // SELECTED USER CHECK
    // ======================================

    if (!selectedUser) {

      console.error(
        "❌ No user selected"
      );

      return;

    }


    // ======================================
    // TEXT + FILE CHECK
    // ======================================

    if (
      !text.trim() &&
      !selectedFile
    ) {

      return;

    }


    // ======================================
    // SOCKET CHECK
    // ======================================

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


    // ======================================
    // AUTH SESSION CHECK
    // ======================================

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


    // ======================================
    // CURRENT USER
    // ======================================

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


    // ======================================
    // ROOM ID
    // ======================================

    const roomId =
      createRoomId(
        currentUserId,
        selectedUserId
      );


    // ======================================
    // FILE UPLOAD
    // ======================================

    let uploadedFile =
      null;


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


    // ======================================
    // SEND MESSAGE THROUGH SOCKET
    // ======================================

    console.log(
      "📤 Sending message:",
      {

        roomId,

        senderId:
          currentUserId,

        receiverId:
          selectedUserId,

        username:
          currentUser.username,

        message:
          text.trim(),

        file:
          uploadedFile,

        sessionId,

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

        username:
          currentUser.username,

        message:
          text.trim(),

        file:
          uploadedFile,

        sessionId,

      }
    );


    // ======================================
    // CLEAR INPUT
    // ======================================

    setText("");

    setSelectedFile(null);


    if (
      fileInputRef.current
    ) {

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


    if (
      bytes < 1024
    ) {

      return `${bytes} B`;

    }


    if (
      bytes < 1024 * 1024
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

                    setIsLogin(
                      false
                    );

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

                    setIsLogin(
                      true
                    );

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
          value={searchText}
          onChange={(e) =>
            setSearchText(e.target.value)
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

                        <span className="online-dot"></span>

                      </div>


                      <div className="last-message">

                        Click to
                        start
                        chatting

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


              <div>

                <h3>
                  {
                    selectedUser.username
                  }
                </h3>

                <span>
                  Online
                </span>

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

                        {/* ==========================
                            TEXT MESSAGE
                        ========================== */}

                        {msg.text && (

                          <p>
                            {
                              msg.text
                            }
                          </p>

                        )}


                        {/* ==========================
                            FILE MESSAGE
                        ========================== */}

                        {msg.file && (

                          <div className="file-message">

                            {/* IMAGE PREVIEW */}

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


                            {/* DOWNLOAD BUTTON */}

                            <button
  type="button"
  className="download-btn"
  onClick={() => downloadFile(msg.file)}
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


                        {/* ==========================
                            TIME
                        ========================== */}

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

              {/* HIDDEN FILE INPUT */}

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


              {/* PLUS BUTTON */}

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


              {/* TEXT INPUT */}

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
                  setText(
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


              {/* SEND BUTTON */}

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

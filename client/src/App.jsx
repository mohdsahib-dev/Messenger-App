import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

function App() {

  // ========================================
  // AUTH
  // ========================================

  const [isLogin, setIsLogin] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");


  // ========================================
  // USERS
  // ========================================

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);


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
  // CURRENT USER
  // ========================================

  const getCurrentUser = () => {

    try {

      return JSON.parse(
        localStorage.getItem("user")
      );

    } catch {

      return null;

    }

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

    console.log("🔌 Connecting Socket.IO...");

    const newSocket = io(
      "https://messenger-app-of9j.onrender.com",
      {
        transports: ["websocket", "polling"],
      }
    );

    socketRef.current = newSocket;


    // ======================================
    // SOCKET CONNECTED
    // ======================================

    newSocket.on("connect", () => {

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

    });


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

        const currentRoomId =
          createRoomId(
            currentUserId,
            selectedUserId
          );

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
            data.message,

          file:
            data.file || null,

          time:
            new Date(
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
                String(formattedMessage._id)
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

      try {

        const response =
          await fetch(
            `https://messenger-app-of9j.onrender.com/api/users/${currentUserId}`
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
        ? "https://messenger-app-of9j.onrender.com/api/auth/login"
        : "https://messenger-app-of9j.onrender.com/api/auth/register";

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

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(
          data.user
        )
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

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
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

    setText("");

    setSelectedFile(null);

    setUploading(false);

  };


  // ========================================
  // SELECT USER
  // ========================================

  const selectUser = async (user) => {

    setSelectedUser(user);

    selectedUserRef.current = user;

    setMessages([]);

    setSelectedFile(null);

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

    console.log(
      "🚪 Joining room:",
      roomId
    );

    socket.emit(
      "join_room",
      roomId
    );

    console.log(
      "✅ Join room event sent:",
      roomId
    );


    // ======================================
    // LOAD OLD MESSAGES
    // ======================================

    try {

      const response =
        await fetch(
          `https://messenger-app-of9j.onrender.com/api/messages/${roomId}`
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
                msg.message,

              file:
                msg.file || null,

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
  // FILE SELECT
  // ========================================

  const handleFileSelect = (e) => {

    const file =
      e.target.files[0];

    if (!file) {
      return;
    }

    // Maximum 20 MB
    const maxSize =
      20 * 1024 * 1024;

    if (
      file.size > maxSize
    ) {

      alert(
        "File size cannot exceed 20 MB."
      );

      e.target.value = "";

      return;

    }

    setSelectedFile(file);

    console.log(
      "📎 Selected file:",
      file
    );

  };


  // ========================================
  // UPLOAD FILE
  // ========================================

  const uploadFile = async () => {

    if (!selectedFile) {
      return null;
    }

    try {

      setUploading(true);

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response =
        await fetch(
          "http://localhost:5000/api/files/upload",
          {
            method: "POST",
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
        data
      );

      return data.file;

    } catch (error) {

      console.error(
        "❌ File upload error:",
        error
      );

      alert(
        error.message ||
        "File upload failed"
      );

      return null;

    } finally {

      setUploading(false);

    }

  };


  // ========================================
  // SEND MESSAGE
  // ========================================

  const sendMessage = async () => {

    // Text OR file required
    if (
      !text.trim() &&
      !selectedFile
    ) {

      return;

    }

    if (!selectedUser) {

      console.error(
        "❌ No user selected"
      );

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


    // ======================================
    // UPLOAD FILE FIRST
    // ======================================

    let uploadedFile = null;

    if (selectedFile) {

      uploadedFile =
        await uploadFile();

      if (!uploadedFile) {

        return;

      }

    }


    // ======================================
    // SEND MESSAGE
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

      }
    );


    // ======================================
    // CLEAR
    // ======================================

    setText("");

    setSelectedFile(null);

    if (
      fileInputRef.current
    ) {

      fileInputRef.current.value = "";

    }

  };


  // ========================================
  // ENTER KEY
  // ========================================

  const handleMessageKeyDown = (e) => {

    if (
      e.key === "Enter"
    ) {

      e.preventDefault();

      sendMessage();

    }

  };


  // ========================================
  // FORMAT FILE SIZE
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
  // GET FILE ICON
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
      )
    ) {

      return "📦";

    }

    return "📄";

  };


  // ========================================
  // RENDER FILE
  // ========================================

  const renderFile = (file) => {

    if (!file) {
      return null;
    }

    const fileUrl =
      `http://localhost:5000${file.fileUrl}`;


    // ======================================
    // IMAGE
    // ======================================

    if (
      file.fileType?.startsWith(
        "image/"
      )
    ) {

      return (

        <div className="chat-file image-file">

          <img
            src={fileUrl}
            alt={
              file.originalName
            }
            className="chat-image"
          />

          <a
            href={fileUrl}
            download={
              file.originalName
            }
            target="_blank"
            rel="noreferrer"
          >
            Download
          </a>

        </div>

      );

    }


    // ======================================
    // OTHER FILES
    // ======================================

    return (

      <div className="chat-file">

        <div className="file-icon">

          {getFileIcon(
            file.fileType
          )}

        </div>

        <div className="file-details">

          <div className="file-name">

            {
              file.originalName
            }

          </div>

          <div className="file-size">

            {
              formatFileSize(
                file.fileSize
              )
            }

          </div>

        </div>

        <a
          href={fileUrl}
          download={
            file.originalName
          }
          target="_blank"
          rel="noreferrer"
          className="download-button"
        >
          Download
        </a>

      </div>

    );

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
          placeholder="Search users..."
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

          ) : (

            users.map(
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
                      selectedId ===
                      userId
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

            {/* CHAT HEADER */}

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


            {/* MESSAGES */}

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


                        {/* TEXT */}

                        {msg.text && (

                          <p>
                            {
                              msg.text
                            }
                          </p>

                        )}


                        {/* FILE */}

                        {msg.file && (

                          renderFile(
                            msg.file
                          )

                        )}


                        {/* TIME */}

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


            {/* SELECTED FILE PREVIEW */}

            {selectedFile && (

              <div className="selected-file">

                <span>

                  📎{" "}
                  {
                    selectedFile.name
                  }

                  {" "}
                  (
                  {
                    formatFileSize(
                      selectedFile.size
                    )
                  }
                  )

                </span>

                <button
                  type="button"
                  onClick={() => {

                    setSelectedFile(
                      null
                    );

                    if (
                      fileInputRef.current
                    ) {

                      fileInputRef.current.value =
                        "";

                    }

                  }}
                >

                  ✕

                </button>

              </div>

            )}


            {/* INPUT */}

            <div className="message-input">

              {/* HIDDEN FILE INPUT */}

              <input
                ref={
                  fileInputRef
                }
                type="file"
                hidden
                onChange={
                  handleFileSelect
                }
              />


              {/* ATTACH BUTTON */}

              <button
                type="button"
                onClick={() => {

                  fileInputRef.current?.click();

                }}
                disabled={
                  uploading
                }
                title="Attach file"
              >

                📎

              </button>


              {/* TEXT INPUT */}

              <input
                type="text"
                placeholder="Type a message..."
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
                  uploading
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


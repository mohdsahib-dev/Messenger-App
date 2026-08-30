
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
  // SOCKET
  // ========================================

  const socketRef = useRef(null);

  // Keep currently selected user accessible
  // inside Socket.IO event handlers
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
      "http://localhost:5000",
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


      // If a chat was already selected,
      // join its room after reconnect
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

          _id: data._id,

          roomId: data.roomId,

          senderId: data.senderId,

          receiverId: data.receiverId,

          username: data.username,

          text: data.message,

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

          // Prevent duplicate messages
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
            `http://localhost:5000/api/users/${currentUserId}`
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
        ? "http://localhost:5000/api/auth/login"
        : "http://localhost:5000/api/auth/register";


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

  };


  // ========================================
  // SELECT USER
  // ========================================

  const selectUser = async (user) => {

    // ======================================
    // SAVE SELECTED USER
    // ======================================

    setSelectedUser(user);

    selectedUserRef.current = user;

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
          `http://localhost:5000/api/messages/${roomId}`
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
  // SEND MESSAGE
  // ========================================

  const sendMessage = () => {

    // ======================================
    // TEXT CHECK
    // ======================================

    if (!text.trim()) {

      return;

    }


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


    console.log(
      "📤 Sending message:",
      {
        roomId,
        senderId: currentUserId,
        receiverId: selectedUserId,
        username:
          currentUser.username,
        message:
          text.trim(),
      }
    );


    // ======================================
    // SEND TO SERVER
    // ======================================

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
      }
    );


    // ======================================
    // CLEAR INPUT
    // ======================================

    setText("");

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

                        <p>
                          {
                            msg.text
                          }
                        </p>


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


            {/* INPUT */}

            <div className="message-input">

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
              />


              <button
                onClick={
                  sendMessage
                }
              >

                Send

              </button>

            </div>

          </>

        )}

      </main>

    </div>

  );

}

export default App;

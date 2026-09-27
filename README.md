# 💬 Messenger App

A real-time chat application built with **React, Node.js, Express, Socket.io, and MongoDB Atlas**.

The app allows users to send and receive messages instantly, view previous messages, and maintain persistent chat history.

## ✨ Features

* 💬 Real-time messaging with **Socket.io**
* ⚡ Instant message delivery without page refresh
* 🗄️ Persistent messages using **MongoDB Atlas**
* 🕒 Message timestamps
* 🔄 Chat history after refreshing the application
* 🔌 Socket connection/disconnection handling
* 🎨 Clean and responsive chat interface
* 📡 REST APIs for sending and retrieving messages

## 🛠️ Tech Stack

**Frontend**

* React
* JavaScript
* CSS
* Socket.io Client

**Backend**

* Node.js
* Express.js
* Socket.io
* MongoDB Atlas

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mohdsahib-dev/Messenger-App.git
cd Messenger-App
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
CLIENT_URL=http://localhost:5173
```

Start the backend:

```bash
npm start
```

### 3. Frontend Setup

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

> Never commit your `.env` file or MongoDB credentials to GitHub.

## 🔌 API

### Send Message

```http
POST /api/messages
```

### Fetch Chat History

```http
GET /api/messages
```

## ⚡ Real-Time Communication

The application uses **Socket.io** for real-time communication.

```text
User A
   │
   │ Send Message
   ▼
Node.js + Socket.io
   │
   │ Broadcast
   ▼
User B
```

Messages are delivered instantly without requiring a page refresh.

## 🗄️ Database

**MongoDB Atlas** is used for persistent message storage.

Messages remain available even after refreshing the application.

## 🎨 UI

The application uses a **Burgundy + Cream** theme with:

* Clear sender/receiver message bubbles
* Message timestamps
* Responsive chat layout
* Clean and user-friendly interface

## 🧠 Design Decisions

* **React** for the interactive chat interface.
* **Node.js + Express** for REST APIs and backend services.
* **Socket.io** for real-time communication.
* **MongoDB Atlas** for persistent message storage.
* REST APIs handle message operations while Socket.io handles instant delivery.

## 🧪 Testing

The main functionality can be tested by opening the application in two browser windows:

1. Connect both users.
2. Send a message from one window.
3. Verify that it appears instantly in the other.
4. Refresh the application.
5. Verify that previous messages are still available.

## 🔗 Links

**GitHub:**
https://github.com/mohdsahib-dev/Messenger-App

**Live Demo:**
https://messenger-app-cyan-two.vercel.app/


## 👨‍💻 Author

**Mohd Sahib**

B.Tech Computer Science & Engineering

[GitHub](https://github.com/mohdsahib-dev) • [LinkedIn](https://www.linkedin.com/in/mohd-sahib-dev/)

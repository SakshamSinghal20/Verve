# 🌊 Verve: Real-Time WebRTC Video Conferencing

**Verve** is a low-latency, real-time audio and video communication platform. Built with the MERN stack (MongoDB, Express, React, Node.js), WebRTC, and Socket.io, it allows users to create instant meeting rooms, join via secure links, and communicate through high-fidelity peer-to-peer media streams and live text chat.

---

## ✨ Features

### Core Functionality
- **Instant Room Generation:** Create unique, secure meeting links (UUID-based) with a single click.
- **Join via Link/Code:** Seamlessly drop into active meetings using a room ID.
- **WebRTC P2P Media:** High-quality, low-latency video and audio streaming directly between browsers.
- **Real-Time Text Chat:** Integrated messaging system powered by Socket.io for instant in-call communication.
- **Hardware Controls:** Dynamic UI to toggle microphone (mute/unmute) and camera (on/off) states.
- **Participant Roster:** Live-updating list of all users currently in the meeting room.

### Stretch Goals (Upcoming)
- **User Authentication:** JWT-based secure signup and login system.
- **Screen Sharing:** Capture and stream local display media to peers.
- **Meeting Controls:** "Raise Hand" functionality and host privileges (kick/mute users).

---

## 🛠️ Tech Stack & Technologies

- **Frontend:** React.js, Context API (State Management), Tailwind CSS.
- **Backend:** Node.js, Express.js.
- **Real-Time Communication:** - **Socket.io:** WebRTC signaling (Offer/Answer/ICE) and chat broadcasting.
  - **WebRTC API:** `RTCPeerConnection`, `getUserMedia`.
- **Database:** MongoDB, Mongoose ODM.
- **Infrastructure:** STUN/TURN servers for NAT traversal.

---

## 🏗️ System Architecture & Data Flow

Verve utilizes a hybrid communication model:

1. **Signaling State (Socket.io):** The Express/Node.js backend acts as a signaling server. When User A wants to call User B, they exchange Session Description Protocol (SDP) data and Interactive Connectivity Establishment (ICE) candidates through secure WebSockets.
2. **Media State (WebRTC):** Once the handshake is complete, a direct Secure Real-time Transport Protocol (SRTP) connection is formed between the clients. Video and audio data bypass the server entirely, flowing in a Peer-to-Peer (P2P) mesh network to ensure zero server bottlenecking and maximum privacy.

*(Placeholder: Add your LLD and Data Flow Diagrams here)*
`![System Architecture](./assets/architecture.png)`

---

## 🗄️ Database Schema (MongoDB)

The application utilizes the following core collections to manage state and history:

- **`Room`:** Stores `roomId` (String, unique), `hostId` (Ref: User), `status` (active/ended), and `createdAt`.
- **`User` (Auth):** Stores `username`, `email`, `passwordHash`, and `avatarUrl`.
- **`Message`:** Stores `roomId` (Ref: Room), `senderName`, `text`, and `timestamp` for chat persistence.
- **`Participant`:** Tracks `roomId`, `guestName`, `joinedAt`, and `leftAt` for meeting analytics.

---

## 🔌 API & Socket Reference

### REST API (Express.js)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/rooms/create` | Generates a new meeting room and returns the `roomId`. |
| `GET` | `/api/rooms/validate/:roomId` | Checks if a room exists and is currently active. |
| `POST` | `/api/auth/register` | *(Stretch)* Registers a new user account. |
| `POST` | `/api/auth/login` | *(Stretch)* Authenticates user and returns JWT. |

### WebSocket Events (Socket.io)
| Event Name | Direction | Payload / Description |
| :--- | :--- | :--- |
| `join-room` | Client ➔ Server | `{ roomId, userId }` Joins the socket to a specific room. |
| `user-connected` | Server ➔ Clients| Broadcasts to the room that a new peer is ready to connect. |
| `webrtc-offer` | Client ➔ Server | Routing SDP offer to a specific peer. |
| `webrtc-answer`| Client ➔ Server | Routing SDP answer back to the caller. |
| `ice-candidate`| Client ➔ Server | Exchanging network routing information. |
| `send-message` | Client ➔ Server | `{ roomId, senderName, text }` Sends a chat message. |
| `receive-message`| Server ➔ Clients| Broadcasts the new message to the chat UI. |
| `toggle-media` | Client ➔ Server | `{ mediaType, isEnabled }` Broadcasts mute/camera off states. |

---

## 📂 Project Structure

```text
verve/
├── client/                 # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable UI (VideoTile, ChatBox, Controls)
│   │   ├── context/        # React Context (SocketContext, WebRTCContext)
│   │   ├── hooks/          # Custom hooks (useWebRTC, useUserMedia)
│   │   ├── pages/          # Route views (Landing, MeetingRoom)
│   │   ├── services/       # API calls to backend
│   │   └── App.js
│   └── package.json
├── server/                 # Node.js/Express Backend
│   ├── config/             # DB connection, STUN/TURN configs
│   ├── controllers/        # Route logic (roomController, authController)
│   ├── models/             # Mongoose Schemas (Room, User, Message)
│   ├── routes/             # Express API routes
│   ├── sockets/            # Socket.io event handlers (signaling, chat)
│   ├── server.js           # Entry point
│   └── package.json
└── README.md

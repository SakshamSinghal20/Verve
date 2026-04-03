<div align="center">

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║    ██╗   ██╗███████╗██████╗ ██╗   ██╗███████╗                    ║
║    ██║   ██║██╔════╝██╔══██╗██║   ██║██╔════╝                    ║
║    ██║   ██║█████╗  ██████╔╝██║   ██║█████╗                      ║
║    ╚██╗ ██╔╝██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝                      ║
║     ╚████╔╝ ███████╗██║  ██║ ╚████╔╝ ███████╗                    ║
║      ╚═══╝  ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝                    ║
║                                                                  ║
║           Video calls that don't suck. Finally.                  ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Mediasoup](https://img.shields.io/badge/Mediasoup-SFU-FF6B6B?style=for-the-badge&logo=webrtc&logoColor=white)](https://mediasoup.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

<br/>

**Crystal-clear video calls. Real-time chat. Zero nonsense.**

*Built with ❤️ by [Saksham Singhal](https://github.com/SakshamSinghal20) & [Shivam Mishra](https://github.com/)*

---

</div>

## 🤔 What is Verve?

Think of it as your own **private, self-hosted video calling platform** — like Zoom met WebRTC at a hackathon and they had a baby that actually works.

Verve uses a **Selective Forwarding Unit (SFU)** architecture via [Mediasoup](https://mediasoup.org), which means your video streams are intelligently routed through the server instead of being peer-to-peer spaghetti. Translation: **it scales, it's fast, and it doesn't melt your CPU**.

---

## ✨ Feature Buffet

> *Pick everything. It's all-you-can-eat.*

| Feature | What it does | Cool factor |
|---|---|---|
| 📹 **Video & Audio** | HD video (720p) + crystal-clear audio with echo cancellation & noise suppression | ⭐⭐⭐⭐⭐ |
| 🏠 **Room System** | Create or join rooms with unique 8-char IDs. Share the code, start the party | ⭐⭐⭐⭐ |
| 💬 **In-Call Chat** | Real-time messaging with unread badges, auto-scroll, and chat history (last 200 msgs) | ⭐⭐⭐⭐ |
| 🖥️ **Screen Sharing** | One-click screen share. Auto-stops when you hit the browser's native stop button | ⭐⭐⭐⭐⭐ |
| 👥 **Participants Panel** | See who's in the room at a glance | ⭐⭐⭐ |
| ✋ **Raise Hand** | Toggle raise hand with animated badge. Auto-lowers after 30s (we know you forget) | ⭐⭐⭐⭐ |
| 🎙️ **Media Controls** | Mute/unmute mic, toggle camera on/off, leave meeting gracefully | ⭐⭐⭐⭐ |
| 📐 **Adaptive Grid** | Smart video layout that adapts for 1, 2, 4, or many participants | ⭐⭐⭐⭐ |
| 🌙 **Dark Theme** | Sleek dark UI built with the Inter font. Your eyes will thank you at 2 AM | ⭐⭐⭐⭐⭐ |
| 🔐 **Authentication** | JWT-based auth with bcrypt password hashing. Register, login, stay secure | ⭐⭐⭐⭐ |
| 📋 **Copy Room ID** | One-click clipboard copy so you can share meeting links instantly | ⭐⭐⭐ |

---

## 🏗️ Architecture

```
                    ╭──────────────────────────────────╮
                    │          THE INTERNET            │
                    ╰──────────┬───────────┬───────────╯
                               │           │
                    ┌──────────▼──┐   ┌────▼──────────┐
                    │  Browser A  │   │   Browser B   │
                    │  (React)    │   │   (React)     │
                    └──────┬──────┘   └──────┬────────┘
                           │                 │
                      produce &          produce &
                      consume            consume
                           │                 │
                    ┌──────▼─────────────────▼────────┐
                    │                                  │
                    │    🚀 Verve Server (Node.js)    │   
                    │                                  │
                    │   ┌────────────────────────┐     │
                    │   │   Mediasoup SFU        │     │
                    │   │   ┌─────┐  ┌─────┐     │     │
                    │   │   │ VP8 │  │Opus │     │     │
                    │   │   │Video│  │Audio│     │     │
                    │   │   └─────┘  └─────┘     │     │
                    │   └────────────────────────┘     │
                    │                                  │
                    │   ┌────────────────────────┐     │
                    │   │  Socket.io Signaling   │     │
                    │   │  + Chat + Hand Raise   │     │
                    │   └────────────────────────┘     │
                    │                                  │
                    │   ┌────────────────────────┐     │
                    │   │  Express REST API      │     │
                    │   │  + JWT Auth            │     │
                    │   └────────────┬───────────┘     │
                    │                │                 │
                    └────────────────┼─────────────────┘
                                     │
                            ┌────────▼────────┐
                            │  MongoDB Atlas  │
                            │  (User Accounts)│
                            └─────────────────┘
```

<details>
<summary><b>🧠 How does the SFU magic work?</b></summary>

<br/>

Instead of every participant sending their video to every other participant (which is **O(n²)** chaos), Verve uses a **Selective Forwarding Unit**:

1. **You produce** → Your camera/mic stream goes to the server (just once!)
2. **Server routes** → Mediasoup intelligently forwards your stream to everyone else
3. **They consume** → Other peers receive your stream from the server

```
Without SFU (Mesh — yikes):          With SFU (Verve — chef's kiss):

   A ←→ B                                A → Server → B
   A ←→ C                                A → Server → C
   A ←→ D                                
   B ←→ C                            Each client: 1 upload, N downloads
   B ←→ D                            Server handles the routing 🎯
   C ←→ D
   
   Each client: N uploads!!! 🔥💀
```

</details>

---

## 🛠️ Tech Stack

<table>
<tr>
<td align="center"><b>Layer</b></td>
<td align="center"><b>Tech</b></td>
<td align="center"><b>Why?</b></td>
</tr>
<tr>
<td>🎨 Frontend</td>
<td>React 19 + Vite 7</td>
<td>Blazing fast HMR, modern React with hooks</td>
</tr>
<tr>
<td>🎭 Styling</td>
<td>Vanilla CSS + Inter font</td>
<td>No bloated frameworks. Pure, hand-crafted CSS</td>
</tr>
<tr>
<td>⚙️ Backend</td>
<td>Node.js + Express 5</td>
<td>Battle-tested, async-first, runs everywhere</td>
</tr>
<tr>
<td>📡 Real-time</td>
<td>Socket.io 4</td>
<td>WebSocket with fallbacks, rooms, and ack support</td>
</tr>
<tr>
<td>📹 Media</td>
<td>Mediasoup 3 (SFU)</td>
<td>Enterprise-grade WebRTC SFU. Handles the hard stuff</td>
</tr>
<tr>
<td>🗄️ Database</td>
<td>MongoDB Atlas</td>
<td>Cloud-native document store for user accounts</td>
</tr>
<tr>
<td>🔐 Auth</td>
<td>JWT + bcrypt</td>
<td>Stateless tokens + salted password hashing</td>
</tr>
<tr>
<td>🧭 Routing</td>
<td>React Router 7</td>
<td>Client-side navigation with dynamic room routes</td>
</tr>
</table>

---

## 🚀 Quick Start

> **Time to first call: ~3 minutes** ⏱️

### Prerequisites

- **Node.js 18+** — [Download here](https://nodejs.org)
- **npm** — Comes with Node.js
- **MongoDB Atlas** account (optional, needed for auth) — [Free tier](https://www.mongodb.com/cloud/atlas)

### 1️⃣ Clone & Install

```bash
# Grab the code
git clone https://github.com/SakshamSinghal20/Verve.git
cd Verve

# Install backend dependencies
cd Backend
npm install

# Install frontend dependencies
cd ../Frontend/Live-calling
npm install
```

### 2️⃣ Environment Setup

<details>
<summary><b>📋 Backend (.env)</b> — click to expand</summary>

```bash
cd Backend
cp .env.example .env
```

Edit `Backend/.env`:

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `5000` | Server port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin for the frontend |
| `SERVER_IP` | `127.0.0.1` | Mediasoup announced IP (use your machine's IP for LAN) |
| `MONGO_URI` | — | MongoDB connection string (for auth) |
| `JWT_SECRET` | `verve-dev-secret-change-me` | Secret for signing JWT tokens |

</details>

<details>
<summary><b>📋 Frontend (.env)</b> — click to expand</summary>

```bash
cd Frontend/Live-calling
cp .env.example .env
```

Edit `Frontend/Live-calling/.env`:

| Variable | Default | What it does |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:5000` | Where the backend lives |

</details>

### 3️⃣ Launch! 🚀

Open **two terminals** and run:

```bash
# Terminal 1 — Backend 🖥️
cd Backend
npm run dev

# Terminal 2 — Frontend 🎨
cd Frontend/Live-calling
npm run dev
```

### 4️⃣ Use it

1. Open **http://localhost:5173** in your browser
2. Click **✦ Create Meeting** to spin up a new room
3. Share the 8-character **Room ID** with friends
4. They paste it in the "Join" field and boom — you're live! 🎉

> 💡 **Pro tip**: Open two browser tabs to test locally. Works like a charm.

---

## 📁 Project Structure

```
Verve/
│
├── 📂 Backend/
│   ├── 🚀 server.js             ← The brain: Mediasoup SFU + Socket.io + chat
│   ├── 📂 middleware/
│   │   └── 🔐 auth.js           ← JWT verification for HTTP & WebSocket
│   ├── 📂 models/
│   │   └── 👤 User.js           ← MongoDB user schema
│   ├── 📂 routes/
│   │   └── 🛣️ auth.js           ← Register & login endpoints
│   ├── 📋 .env.example           ← Env template (don't commit the real .env!)
│   └── 📦 package.json
│
├── 📂 Frontend/
│   └── 📂 Live-calling/
│       ├── 📂 src/
│       │   ├── 🏠 App.jsx       ← Landing page: create/join rooms, auth UI
│       │   ├── 🎨 App.css       ← Landing page dark theme styles
│       │   ├── 🌍 index.css     ← Global styles (Inter font, resets)
│       │   ├── ⚡ main.jsx      ← React Router setup
│       │   └── 📂 pages/
│       │       ├── 📹 Room.jsx  ← THE room: video, chat, controls, everything
│       │       ├── 🎨 Room.css  ← Room layout & component styles
│       │       ├── 🔑 Login.jsx  ← Login form
│       │       ├── 📝 Register.jsx ← Registration form
│       │       └── 🎨 Auth.css  ← Auth page styles
│       ├── 📋 .env.example       ← Frontend env template
│       └── 📦 package.json
│
├── 📋 .gitignore
└── 📖 README.md                  ← You are here! 👋
```

---

## 🔌 Socket Events Cheatsheet

> For the curious devs who want to peek under the hood.

<details>
<summary><b>📡 Click to see all Socket.io events</b></summary>

### Client → Server

| Event | Payload | Response | What happens |
|---|---|---|---|
| `join-room` | `roomId` | `{ rtpCapabilities }` | Joins/creates a room, returns router caps |
| `create-send-transport` | — | Transport params | Creates a WebRTC transport for sending media |
| `create-recv-transport` | — | Transport params | Creates a WebRTC transport for receiving media |
| `connect-transport` | `{ transportId, dtlsParameters }` | `{ connected }` | DTLS handshake to establish secure connection |
| `produce` | `{ transportId, kind, rtpParameters }` | `{ id }` | Start sending your video/audio/screen |
| `consume` | `{ producerId, rtpCapabilities }` | Consumer params | Start receiving someone else's media |
| `resume-consumer` | `{ consumerId }` | `{ resumed }` | Unpause a consumer (starts media flow) |
| `get-producers` | — | `{ producers[] }` | Get all existing producers to consume |
| `send-message` | `{ message }` | `{ sent }` | Send a chat message |
| `get-chat-history` | — | `{ messages[] }` | Fetch room's chat history (max 200) |
| `raise-hand` | `{ raised }` | — | Toggle hand raise |

### Server → Client

| Event | Payload | When |
|---|---|---|
| `new-producer` | `{ producerId, peerId, kind }` | Someone started sharing media |
| `new-peer` | `{ peerId }` | Someone joined the room |
| `peer-left` | `{ peerId }` | Someone left the room |
| `producer-closed` | `{ producerId }` | A media stream was stopped |
| `peers-list` | `{ peers[] }` | Updated list of all peers |
| `new-message` | `{ peerId, message, timestamp }` | New chat message |
| `hand-raised` | `{ peerId, raised }` | Someone raised/lowered hand |

</details>

---

## 🔐 Auth Flow

```
                    ┌──────────┐          ┌──────────┐          ┌─────────┐
                    │  Client  │          │  Server  │          │ MongoDB │
                    └────┬─────┘          └────┬─────┘          └────┬────┘
                         │                     │                     │
    Register/Login ──────┤  POST /api/auth/*   │                     │
                         │ ──────────────────► │                     │
                         │                     │  find/create user   │
                         │                     │ ──────────────────► │
                         │                     │ ◄────────────────── │
                         │                     │                     │
                         │   { token, user }   │  bcrypt + JWT sign  │
                         │ ◄────────────────── │                     │
                         │                     │                     │
    Store in             │                     │                     │
    localStorage ────────┤                     │                     │
                         │                     │                     │
    Socket.io connect ───┤  auth: { token }    │                     │
                         │ ──────────────────► │  JWT verify         │
                         │                     │──┐                  │
                         │   ✅ Connected      │◄─┘                  │
                         │ ◄────────────────── │                     │
                         ▼                     ▼                     ▼
```

---

## 🧪 API Endpoints

| Method | Endpoint | Body | Response | Auth? |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | `{ name, email, password }` | `{ token, user }` | ❌ |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ token, user }` | ❌ |
| `GET` | `/` | — | `"Server is running"` | ❌ |

---

## 🎯 Roadmap

- [x] Core video & audio calling with SFU
- [x] Room system with unique IDs
- [x] In-call chat with history
- [x] Screen sharing
- [x] Raise hand feature
- [x] Adaptive grid layout
- [x] Dark theme UI
- [x] User authentication (JWT + MongoDB)
- [ ] User profile pictures & display names in calls
- [ ] Recording support
- [ ] Virtual backgrounds
- [ ] Breakout rooms
- [ ] Mobile-responsive design
- [ ] E2E encryption

---

## 🤝 Contributing

We love contributions! Here's how:

1. **Fork** the repo
2. **Create** your feature branch (`git checkout -b feature/amazing-thing`)
3. **Commit** your changes (`git commit -m 'Add amazing thing'`)
4. **Push** to the branch (`git push origin feature/amazing-thing`)
5. **Open** a Pull Request

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

### Built with 🔥 by

**Saksham Singhal** · **Shivam Mishra**

<br/>

*If Verve made your calls better, give it a ⭐ — it fuels our late-night coding sessions!*

```
  ___
    /   \      "Let's hop on Verve"
   | 👀 |       — said every cool dev ever
 \___/
```

</div>

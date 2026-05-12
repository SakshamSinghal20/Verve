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
║     Video calls that don't suck. An SDK that finally works.      ║
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

**Crystal-clear video calls · Multi-tenant embeds · Developer SDK**

*Built with ❤️ by [Saksham Singhal](https://github.com/SakshamSinghal20)*

---

</div>

## 🤔 What is Verve?

Verve started as a **private, self-hosted video calling platform** — like Zoom met WebRTC at a hackathon and had a baby that actually works.

It has since evolved into a **hybrid communication SDK platform**. You can embed Verve directly into any website via an `<iframe>`, or integrate it fully into any application using the **Verve JavaScript SDK** and prebuilt React components. All while keeping Mediasoup/WebRTC internals completely hidden from consumers.

Verve uses a **Selective Forwarding Unit (SFU)** architecture via [Mediasoup](https://mediasoup.org) — streams are intelligently routed through the server instead of P2P spaghetti. Translation: **it scales, it's fast, and it doesn't melt your CPU**.

---

## ✨ Feature Buffet

> *Pick everything. It's all-you-can-eat.*

### Core Meeting Features

| Feature | What it does |
|---|---|
| 📹 **Video & Audio** | HD video (720p) + crystal-clear audio with echo cancellation & noise suppression |
| 🏠 **Room System** | Create or join rooms with unique IDs. Share the code, start the party |
| 💬 **In-Call Chat** | Real-time messaging with unread badges, auto-scroll, and chat history (last 200 msgs) |
| 🖥️ **Screen Sharing** | One-click screen share. Auto-stops when you hit the browser's native stop button |
| 👥 **Participants Panel** | See who's in the room at a glance |
| ✋ **Raise Hand** | Toggle raise hand with animated badge. Auto-lowers after 30s |
| 🎙️ **Media Controls** | Mute/unmute mic, toggle camera on/off, leave meeting gracefully |
| 📐 **Adaptive Grid** | Smart video layout that adapts for 1, 2, 4, or many participants |
| 🌙 **Dark Theme** | Sleek dark UI. Your eyes will thank you at 2 AM |
| 🔐 **Authentication** | JWT-based auth with bcrypt password hashing. Register, login, stay secure |
| 🎭 **Reactions** | Send floating emoji reactions during calls |
| ⏱️ **Focus Timer** | Host-controlled countdown timer visible to all participants |
| 📌 **Pin to Focus** | Pin any participant's stream to full-screen focus view |
| 📊 **Speaking Stats** | Track how long each participant has spoken |

### Phase 1 — Embeddable White-Label System

| Feature | What it does |
|---|---|
| 🏢 **Multi-Tenant** | Isolated rooms per tenant — guests from one tenant can never access another's rooms |
| 🎨 **Dynamic Branding** | Tenants configure logo & primary color; embed view applies them automatically via CSS vars |
| 🔑 **Embed Tokens** | Versioned, scoped JWTs (v1) bind a guest to a specific tenant + room |
| 🔒 **Origin Protection** | `allowedOrigins` enforcement — only whitelisted domains can embed your rooms |
| ♻️ **Auto Room Expiry** | MongoDB TTL index auto-deletes rooms after their configured lifetime |
| 🪟 **iframe Support** | Embed any tenant room with a single `<iframe>` tag |

### Phase 2 — Hybrid Communication SDK

| Feature | What it does |
|---|---|
| 📦 **npm-first SDK** | `Verve.init()` → clean session object. No Mediasoup knowledge required |
| 🤝 **State Machine** | Connection lifecycle: `idle → connecting → connected → reconnecting → disconnected → destroyed` |
| 🎯 **Stable Events** | Namespaced event contract: `participant.joined`, `chat.message`, `room.ended`, etc. |
| 🧩 **Prebuilt Components** | `VerveRoom`, `VerveControls`, `VerveChat`, `VerveParticipants` — ready to drop in |
| 🎨 **CSS Variable Theming** | Override `--verve-primary`, `--verve-bg`, `--verve-text` etc. on `.verve-root` |
| ⚙️ **Room Config** | Disable chat, camera, or screen share per session via config object |
| 🔒 **Framework Agnostic Core** | `VerveSession` has zero React imports — usable in Vue, Svelte, vanilla JS, or anywhere |

---

## 🏗️ Architecture

```
                    ╭──────────────────────────────────╮
                    │          THE INTERNET            │
                    ╰──────────┬───────────┬───────────╯
                               │           │
                    ┌──────────▼──┐   ┌────▼──────────┐   ┌──────────────────┐
                    │  Browser A  │   │   Browser B   │   │  3rd-party App   │
                    │  (React)    │   │   (React)     │   │  (SDK / iframe)  │
                    └──────┬──────┘   └──────┬────────┘   └────────┬─────────┘
                           │                 │                     │
                      produce &          produce &           Verve SDK / iframe
                      consume            consume                   │
                           │                 │                     │
                    ┌──────▼─────────────────▼─────────────────────▼──────┐
                    │                                                       │
                    │             🚀 Verve Server (Node.js)               │
                    │                                                       │
                    │   ┌─────────────────┐   ┌───────────────────────┐    │
                    │   │  Mediasoup SFU  │   │  Tenant API           │    │
                    │   │  (WebRTC/RTP)   │   │  POST /rooms          │    │
                    │   └─────────────────┘   │  POST /rooms/:id/token│    │
                    │                         │  GET  /branding/:id   │    │
                    │   ┌─────────────────┐   └───────────────────────┘    │
                    │   │  Socket.io      │                                 │
                    │   │  Signaling +    │   ┌───────────────────────┐    │
                    │   │  Chat + Raise   │   │  JWT Auth Middleware  │    │
                    │   │  Hand + Embed   │   │  (DB users + guests)  │    │
                    │   └─────────────────┘   └───────────────────────┘    │
                    └───────────────────────────────┬───────────────────────┘
                                                    │
                                           ┌────────▼────────┐
                                           │  MongoDB Atlas  │
                                           │  Users, Tenants │
                                           │  Rooms (TTL)    │
                                           └─────────────────┘
```

### SDK Integration Layers

```
Developer Code
     │
     ├── Path 1: iframe embed (Phase 1)
     │     <iframe src="/embed/ROOM?token=JWT" />
     │
     ├── Path 2: SDK headless (Phase 2)
     │     const session = await Verve.init({ apiKey, roomId, user })
     │     await session.joinRoom()
     │     session.on("participant.joined", handler)
     │
     └── Path 3: SDK prebuilt React (Phase 2)
           <VerveProvider session={session}>
             <VerveRoom />
           </VerveProvider>

All three paths use the same backend, same socket events, same Mediasoup stack.

Vanilla SDK Core (framework-agnostic)
    ↓
React Bindings / Prebuilt Components
    ↓
Existing RTC Core (untouched)
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

   Each client: N uploads!!! 🔥💀       Each client: 1 upload, N downloads
                                          Server handles the routing 🎯
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
<td>Vanilla CSS + CSS Variables</td>
<td>Pure hand-crafted CSS, SDK theming via custom properties</td>
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
<td>Cloud-native document store; TTL indexes for room cleanup</td>
</tr>
<tr>
<td>🔐 Auth</td>
<td>JWT + bcrypt</td>
<td>Stateless tokens (versioned v1) + salted password hashing</td>
</tr>
<tr>
<td>🧭 Routing</td>
<td>React Router 7</td>
<td>Client-side navigation with /room, /embed, and dynamic routes</td>
</tr>
<tr>
<td>📦 SDK</td>
<td>Vanilla JS (framework-agnostic)</td>
<td>Works in React, Vue, Svelte, or plain JS apps</td>
</tr>
</table>

---

## 🚀 Quick Start

> **Time to first call: ~3 minutes** ⏱️

### Prerequisites

- **Node.js 18+** — [Download here](https://nodejs.org)
- **npm** — Comes with Node.js
- **MongoDB Atlas** account — [Free tier](https://www.mongodb.com/cloud/atlas)

### 1️⃣ Clone & Install

```bash
git clone https://github.com/SakshamSinghal20/Verve.git
cd Verve

# Backend
cd Backend && npm install

# Frontend
cd ../Frontend/Live-calling && npm install
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
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `SERVER_IP` | `127.0.0.1` | Mediasoup announced IP |
| `MONGO_URI` | — | MongoDB connection string |
| `JWT_SECRET` | `verve-dev-secret-change-me` | Signs all JWTs (user & embed) |

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
| `VITE_BACKEND_URL` | `http://localhost:5000` | Backend URL |

</details>

### 3️⃣ Launch! 🚀

```bash
# Terminal 1 — Backend
cd Backend && node server.js

# Terminal 2 — Frontend
cd Frontend/Live-calling && npm run dev
```

### 4️⃣ Use it

1. Open **http://localhost:5173** in your browser
2. Register an account, then click **✦ Create Meeting**
3. Share the **Room ID** — they paste it in Join and you're live 🎉

> 💡 Open two browser tabs to test locally.

---

## 📁 Project Structure

```
Verve/
│
├── 📂 Backend/
│   ├── 🚀 server.js                ← SFU + Socket.io + Tenant isolation
│   ├── 📂 middleware/
│   │   └── 🔐 auth.js              ← JWT verification (DB users + embed guests)
│   ├── 📂 models/
│   │   ├── 👤 User.js              ← MongoDB user schema
│   │   ├── 🏢 Tenant.js            ← Multi-tenant schema + API key generator
│   │   └── 🚪 Room.js              ← Room schema with tenantId + TTL expiry
│   ├── 📂 routes/
│   │   ├── 🛣️ auth.js              ← Register & login endpoints
│   │   └── 🏢 tenant.js            ← Tenant API: rooms, tokens, branding
│   └── 📋 .env.example
│
├── 📂 Frontend/
│   └── 📂 Live-calling/
│       └── 📂 src/
│           ├── 🏠 App.jsx           ← Landing page
│           ├── ⚡ main.jsx          ← Router: /room, /embed, /login, /register
│           ├── 🔌 socket.js         ← Socket factory (supports embed tokens)
│           ├── 📂 context/
│           │   ├── AuthContext.jsx   ← User session context
│           │   └── EmbedContext.jsx  ← Embed mode + tenant context
│           ├── 📂 hooks/
│           │   └── 🎣 useRoomSocket.js ← All Mediasoup + socket logic
│           ├── 📂 pages/
│           │   ├── 📹 Room.jsx       ← Standard meeting room
│           │   ├── 🪟 EmbedRoom.jsx  ← Branded iframe-friendly room
│           │   ├── 🎨 EmbedRoom.css  ← Embed-specific styles
│           │   ├── 🔑 Login.jsx
│           │   └── 📝 Register.jsx
│           ├── 📂 components/
│           │   ├── VideoGrid.jsx     ← Adaptive video layout
│           │   ├── ControlBar.jsx    ← Mic, cam, screen, chat controls
│           │   ├── ChatPanel.jsx     ← Real-time chat panel
│           │   ├── ParticipantsPanel.jsx
│           │   ├── SpeakingStatsPanel.jsx
│           │   ├── TimerBar.jsx
│           │   ├── ReactionOverlay.jsx
│           │   └── Icons.jsx
│           ├── 📂 sdk/               ← 📦 Phase 2: Verve Communication SDK
│           │   ├── index.js          ← Barrel export (single import path)
│           │   ├── VerveSDK.js       ← Verve.init() entry point
│           │   ├── VerveSession.js   ← State machine + event translation
│           │   ├── VerveEventEmitter.js ← Namespaced event system
│           │   ├── VerveProvider.jsx ← React context + theme application
│           │   ├── VerveTheme.css    ← CSS variable theming layer
│           │   ├── VerveRoom.jsx     ← Full prebuilt room component
│           │   ├── VerveControls.jsx ← Standalone control bar
│           │   ├── VerveChat.jsx     ← Standalone chat panel
│           │   └── VerveParticipants.jsx ← Standalone participants panel
│           └── 📂 utils/
│               └── decodeJwt.js      ← Client-side JWT decoder (UI only)
│
└── 📖 README.md
```

---

## 🏢 Multi-Tenant Embed API (Phase 1)

The Tenant API lets any third-party service embed Verve rooms with full branding isolation. All RTC logic is reused — no parallel engine.

### Register a Tenant

```bash
POST /api/tenant/register
Content-Type: application/json

{
  "name": "Acme Corp",
  "primaryColor": "#ff6b00",
  "allowedOrigins": ["https://acme.com"]
}
```

Response:
```json
{
  "tenantId": "...",
  "apiKey": "vk_...",
  "primaryColor": "#ff6b00"
}
```

### Create a Room

```bash
POST /api/tenant/rooms
x-api-key: vk_...

{ "ttlHours": 2 }
```

Response:
```json
{
  "roomId": "abc123def456",
  "embedUrl": "http://localhost:5173/embed/abc123def456",
  "expiresAt": "2024-01-01T14:00:00.000Z"
}
```

### Generate an Embed Token

```bash
POST /api/tenant/rooms/:roomId/token
x-api-key: vk_...

{ "guestName": "Alice", "role": "participant" }
```

Response:
```json
{
  "token": "eyJ...",
  "embedUrl": "http://localhost:5173/embed/ROOM?token=eyJ...",
  "guestId": "guest_abc123"
}
```

### Embed via iframe

```html
<iframe
  src="http://localhost:5173/embed/ROOM_ID?token=JWT_TOKEN"
  allow="camera; microphone; display-capture"
  width="100%"
  height="600px"
/>
```

---

## 📦 Verve SDK (Phase 2)

The SDK provides a clean, high-level API for code-based integration. Mediasoup/WebRTC internals stay completely hidden.

### Installation

```bash
# Import directly from the src/sdk path (monorepo setup)
import Verve from "./sdk";
```

### Initialize & Join

```js
const session = await Verve.init({
  apiKey: "vk_...",
  roomId: "abc123def456",
  user: { name: "Alice", role: "participant" },
  config: {
    chatEnabled: true,
    screenShareEnabled: true,
    cameraEnabled: true,
  },
  theme: {
    primary: "#7c3aed",
    bg: "#0a0a0f",
    text: "#ffffff",
  },
});

await session.joinRoom();
```

### Actions

```js
session.toggleMic();          // mute / unmute
session.toggleCamera();       // camera on / off
session.startScreenShare();   // start sharing
session.stopScreenShare();    // stop sharing
session.sendMessage("hello"); // send chat message
session.toggleRaiseHand();    // raise / lower hand
session.leaveRoom();          // disconnect
session.destroy();            // full cleanup
```

### Events

```js
session.on("room.connected",        (data) => { /* ... */ });
session.on("room.disconnected",     (data) => { /* ... */ });
session.on("room.ended",            (data) => { /* ... */ });
session.on("participant.joined",    (data) => { /* id, name */ });
session.on("participant.left",      (data) => { /* id, name */ });
session.on("chat.message",          (msg)  => { /* ... */ });
session.on("mic.changed",           (data) => { /* ... */ });
session.on("camera.changed",        (data) => { /* ... */ });
session.on("screenShare.started",   (data) => { /* ... */ });
session.on("screenShare.stopped",   (data) => { /* ... */ });
session.on("room.stateChanged",     ({ from, to }) => { /* state machine */ });
```

### Connection State Machine

```
idle → connecting → connected → reconnecting → disconnected → destroyed
```

```js
console.log(session.connectionState); // "idle" | "connecting" | "connected" | ...
console.log(session.connected);       // boolean shorthand
```

### Prebuilt React Components

```jsx
import { VerveProvider, VerveRoom } from "./sdk";

function App() {
  return (
    <VerveProvider session={session}>
      <VerveRoom />
    </VerveProvider>
  );
}
```

### CSS Theming

Override CSS variables on `.verve-root` or pass `theme` to `Verve.init()`:

```css
.verve-root {
  --verve-primary: #7c3aed;
  --verve-bg:      #0a0a0f;
  --verve-text:    #ffffff;
  --verve-border:  rgba(255, 255, 255, 0.08);
  --verve-font:    'Inter', sans-serif;
  --verve-radius:  12px;
}
```

---

## 🔌 Socket Events Reference

<details>
<summary><b>📡 Click to see all Socket.io events</b></summary>

### Client → Server

| Event | Payload | What happens |
|---|---|---|
| `join-room` | `roomId` | Joins/creates a room, returns router RTP capabilities |
| `create-send-transport` | — | Creates a WebRTC send transport |
| `create-recv-transport` | — | Creates a WebRTC receive transport |
| `connect-transport` | `{ transportId, dtlsParameters }` | DTLS handshake |
| `produce` | `{ transportId, kind, rtpParameters }` | Start sending media |
| `consume` | `{ producerId, rtpCapabilities }` | Start receiving media |
| `resume-consumer` | `{ consumerId }` | Unpause a consumer |
| `get-producers` | — | Get all existing producers |
| `send-message` | `{ message }` | Send a chat message |
| `get-chat-history` | — | Fetch room chat history |
| `raise-hand` | `{ raised }` | Toggle hand raise |
| `toggle-mute` | — | Toggle microphone mute |
| `toggle-camera` | — | Toggle camera on/off |

### Server → Client

| Event | Payload | When |
|---|---|---|
| `new-producer` | `{ producerId, peerId, kind }` | Someone started sharing media |
| `new-peer` | `{ peerId }` | Someone joined |
| `peer-left` | `{ peerId }` | Someone left |
| `producer-closed` | `{ producerId }` | A media stream stopped |
| `peers-list` | `{ peers[] }` | Updated peer list |
| `new-message` | `{ peerId, message, timestamp }` | New chat message |
| `hand-raised` | `{ peerId, raised }` | Hand raise toggled |
| `room-ended` | — | Host ended the meeting |
| `user-joined` | `{ userId, name }` | SDK: participant joined |
| `user-left` | `{ userId, name }` | SDK: participant left |

</details>

---

## 🧪 API Endpoints

### Auth API

| Method | Endpoint | Body | Auth? |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ name, email, password }` | ❌ |
| `POST` | `/api/auth/login` | `{ email, password }` | ❌ |

### Tenant API

| Method | Endpoint | Body | Auth? |
|---|---|---|---|
| `POST` | `/api/tenant/register` | `{ name, primaryColor, allowedOrigins }` | ❌ |
| `POST` | `/api/tenant/rooms` | `{ ttlHours }` | ✅ `x-api-key` |
| `POST` | `/api/tenant/rooms/:roomId/token` | `{ guestName, role }` | ✅ `x-api-key` |
| `GET` | `/api/tenant/branding/:tenantId` | — | ❌ (public) |
| `PUT` | `/api/tenant/branding` | `{ name, logo, primaryColor, allowedOrigins }` | ✅ `x-api-key` |

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
- [x] Speaking stats panel
- [x] Floating emoji reactions
- [x] Focus timer (host-controlled)
- [x] Pin-to-focus participant view
- [x] **Phase 1: Multi-tenant embed system with branded iframes**
- [x] **Phase 1: Scoped JWT embed tokens with TTL room expiry**
- [x] **Phase 1: Origin-validated allowedOrigins for iframe security**
- [x] **Phase 2: Hybrid Communication SDK (Verve.init)**
- [x] **Phase 2: Connection state machine**
- [x] **Phase 2: Namespaced event system**
- [x] **Phase 2: Prebuilt React components (VerveRoom, VerveChat, etc.)**
- [x] **Phase 2: CSS variable theming layer**
- [ ] Recording support
- [ ] Virtual backgrounds
- [ ] Breakout rooms
- [ ] Mobile-responsive design
- [ ] E2E encryption

---

## 🤝 Contributing

1. **Fork** the repo
2. **Create** your feature branch (`git checkout -b feature/amazing-thing`)
3. **Commit** your changes (`git commit -m 'Add amazing thing'`)
4. **Push** to the branch (`git push origin feature/amazing-thing`)
5. **Open** a Pull Request

---

## 📜 License

This project is available under the [MIT License](LICENSE).

---

<div align="center">

### Built with 🔥 by

**Saksham Singhal and Shivam Mishra** 

<br/>

*If Verve made your calls better, give it a ⭐ — it fuels the late-night coding sessions!*

</div>

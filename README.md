# Verve — Real-Time Video Communication

Crystal-clear video calls, instantly. Built with React, Node.js, Socket.io, and Mediasoup (SFU).

## Features

- **Video & Audio Calls** — Real-time media streaming via Mediasoup SFU
- **Room System** — Create or join rooms with unique 8-character IDs
- **In-Call Chat** — Real-time messaging with unread badges and auto-scroll
- **Screen Sharing** — Share your screen with one click, auto-stops on browser native button
- **Participant List** — Side panel showing all connected peers
- **Raise Hand** — Toggle hand raise with animated badge, auto-lowers after 30s
- **Media Controls** — Mute mic, toggle camera, leave meeting
- **Multi-Participant** — Adaptive grid layout for 1, 2, 4, or many participants
- **Dark Theme** — Sleek dark UI built with Inter font

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Vanilla CSS |
| Backend | Node.js, Express |
| Real-time | Socket.io |
| Media | Mediasoup (SFU architecture) |

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### 1. Clone & Install

```bash
git clone https://github.com/SakshamSinghal20/Verve.git
cd Verve

# Backend
cd Backend
npm install

# Frontend
cd ../Frontend/Live-calling
npm install
```

### 2. Configure Environment

**Backend** — copy `.env.example` to `.env`:
```bash
cd Backend
cp .env.example .env
```

**Frontend** — copy `.env.example` to `.env`:
```bash
cd Frontend/Live-calling
cp .env.example .env
```

### 3. Run

```bash
# Terminal 1 — Backend
cd Backend
npm run dev

# Terminal 2 — Frontend
cd Frontend/Live-calling
npm run dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
Verve/
├── Backend/
│   ├── server.js          # Mediasoup SFU + Socket.io signaling + chat
│   ├── .env.example       # Environment variables template
│   └── package.json
├── Frontend/
│   └── Live-calling/
│       ├── src/
│       │   ├── App.jsx        # Landing page (create/join room)
│       │   ├── App.css        # Landing page styles
│       │   ├── index.css      # Global styles
│       │   ├── main.jsx       # React router setup
│       │   └── pages/
│       │       ├── Room.jsx   # Video room (media, chat, controls)
│       │       └── Room.css   # Room styles
│       ├── .env.example       # Frontend env template
│       └── index.html
└── README.md
```

## Environment Variables

### Backend (`Backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Server port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `SERVER_IP` | `127.0.0.1` | Mediasoup announced IP |

### Frontend (`Frontend/Live-calling/.env`)
| Variable | Default | Description |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:5000` | Backend Socket.io URL |

## Architecture

```
Browser A ──┐                    ┌── Browser B
  (produce) │    ┌──────────┐    │ (consume)
  video ────┼───>│ Mediasoup │───┼──> video
  audio ────┼───>│   SFU     │───┼──> audio
  screen ───┼───>│ (server)  │───┼──> screen
  (consume) │    └──────────┘    │ (produce)
  video <───┼────             ───┼──< video
```

## Authors

- Saksham Singhal
- Shivam Mishra

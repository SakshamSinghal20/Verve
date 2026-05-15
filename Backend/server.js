require("dotenv").config();

const mediasoup = require("mediasoup");
const express   = require("express");
const http      = require("http");
const cors      = require("cors");
const mongoose  = require("mongoose");

const authRoutes   = require("./routes/auth");
const roomRoutes   = require("./routes/rooms");
const tenantRoutes = require("./routes/tenant");
const Room       = require("./models/Room");
const { socketAuthMiddleware } = require("./middleware/auth");

const app    = express();
const server = http.createServer(app);

// ── Config constants ────────────────────────────────────────────────────────

const FRONTEND_URL = process.env.FRONTEND_URL;
const SERVER_IP    = process.env.SERVER_IP;
const PORT         = process.env.PORT;

/** Maximum speaking-update ms accepted per event (prevents runaway accumulation). */
const MAX_SPEAKING_UPDATE_MS = 10000;

/** How often speaking stats are broadcast to the room (ms). */
const SPEAKING_STATS_BROADCAST_MS = 5000;

/** Minimum focus timer duration (ms). */
const TIMER_MIN_MS = 60000;      // 1 minute

/** Maximum focus timer duration (ms). */
const TIMER_MAX_MS = 3600000;   // 60 minutes

/** Mediasoup WebRTC port range (must be open in firewall). */
const RTC_MIN_PORT = 20000;
const RTC_MAX_PORT = 20200;

/** Initial outgoing bitrate for WebRTC transports (bps). */
const INITIAL_BITRATE = 1000000;

/** Maximum in-memory chat messages retained per room. */
const MAX_CHAT_HISTORY = 200;

/** Rate-limit for reactions: minimum ms between two reactions from the same socket. */
const REACTION_RATE_LIMIT_MS = 1000;

// ── CORS ────────────────────────────────────────────────────────────────────

// Parse allowed origins (comma-separated) and strip trailing slashes
const allowedOrigins = FRONTEND_URL
    .split(",")
    .map((url) => url.trim().replace(/\/+$/, ""))
    .filter(Boolean);

// Dynamic CORS origin checker — also accepts Vercel preview deployments
function checkCorsOrigin(origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Exact match against allowed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow any localhost port (covers Vite booting on 5173, 5174, 3000, etc.)
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);

    // Allow any Vercel preview/production deployment for this project
    if (/^https:\/\/verve[a-z0-9-]*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
    }

    callback(new Error(`CORS: origin ${origin} not allowed`));
}

app.use(cors({ origin: checkCorsOrigin, credentials: true }));
app.use(express.json());

app.get("/", (req, res) => res.send("Server is running"));

app.use("/api/auth",   authRoutes);
app.use("/api/rooms",  roomRoutes);
app.use("/api/tenant", tenantRoutes);

// ── Socket.IO ───────────────────────────────────────────────────────────────

const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin:      checkCorsOrigin,
        methods:     ["GET", "POST"],
        credentials: true,
    },
});

io.use(socketAuthMiddleware);

// ── Mediasoup ───────────────────────────────────────────────────────────────

let worker;

async function createWorker() {
    worker = await mediasoup.createWorker({
        rtcMinPort: RTC_MIN_PORT,
        rtcMaxPort: RTC_MAX_PORT,
    });
    console.log("✅ Mediasoup Worker created");

    worker.on("died", () => {
        console.error("❌ Mediasoup worker died – exiting");
        process.exit(1);
    });
}

const mediaCodecs = [
    { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
    { kind: "video", mimeType: "video/VP8",  clockRate: 90000 },
];


const rooms = new Map();

// ── Room helpers ────────────────────────────────────────────────────────────

function getOrCreatePeer(roomId, socketId) {
    const room = rooms.get(roomId);
    if (!room) return null;

    if (!room.peers.has(socketId)) {
        room.peers.set(socketId, {
            sendTransport: null,
            recvTransport: null,
            producers: new Map(),
            consumers: new Map(),
        });
    }
    return room.peers.get(socketId);
}

function buildPeersList(room) {
    return Array.from(room.peers.keys()).map((pid) => {
        const info = room.usersInRoom.get(pid) || { userId: pid, name: "Unknown" };
        return { peerId: pid, userId: info.userId, name: info.name };
    });
}

async function createWebRtcTransport(router) {
    const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: SERVER_IP }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: INITIAL_BITRATE,
    });

    transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "closed") transport.close();
    });

    return transport;
}

/**
 * Closes all mediasoup resources for a room and removes it from memory.
 * Also clears any running intervals/timeouts attached to the room.
 * Does NOT touch MongoDB — callers handle that separately.
 */
function closeRoom(room) {
    for (const [, peer] of room.peers) {
        peer.producers.forEach((p) => p.close());
        peer.consumers.forEach((c) => c.close());
        peer.sendTransport?.close();
        peer.recvTransport?.close();
    }
    room.router.close();
    if (room.statsInterval) clearInterval(room.statsInterval);
    if (room.timerTimeout)  clearTimeout(room.timerTimeout);
}

// ── Socket.IO event handlers ────────────────────────────────────────────────

io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    socket.roomId = null;

    socket.on("join-room", async (rawRoomId, callback) => {
        try {
            if (!worker) return callback({ error: "Server not ready" });
            if (!socket.user) return callback({ error: "Authentication required" });

            // Normalize to match the REST routes (which also lowercase + trim)
            const roomId = rawRoomId.trim().toLowerCase();
            const { id: userId, name } = socket.user;

            // ── Tenant-room isolation (constraint 11) ────────────────────
            // One DB read shared by both paths to avoid duplicate queries.
            const dbRoomRecord = await Room.findOne({ roomId }).lean();

            if (socket.embedContext) {
                // Embed socket: JWT roomId must match the requested room
                if (socket.embedContext.roomId !== roomId) {
                    return callback({ error: "Room ID does not match embed token" });
                }
                if (!dbRoomRecord || String(dbRoomRecord.tenantId) !== socket.embedContext.tenantId) {
                    return callback({ error: "Invalid room or tenant mismatch" });
                }
                // Constraint 8: reject expired rooms at join time
                if (dbRoomRecord.expiresAt && new Date(dbRoomRecord.expiresAt) < new Date()) {
                    return callback({ error: "This room has expired" });
                }
            } else {
                // Regular socket: cannot impersonate or enter tenant rooms (constraint 11)
                if (dbRoomRecord && dbRoomRecord.tenantId) {
                    return callback({ error: "This room requires an embed token" });
                }
            }

            socket.join(roomId);
            socket.roomId = roomId;

            if (!rooms.has(roomId)) {
                const router = await worker.createRouter({ mediaCodecs });
                rooms.set(roomId, {
                    router,
                    peers:         new Map(),
                    usersInRoom:   new Map(),
                    chatHistory:   [],
                    // For tenant rooms the first embed guest becomes the in-memory "creator"
                    // for timer/end-meeting gating. This does NOT affect DB ownership.
                    creatorUserId: userId,
                    tenantId:      socket.embedContext?.tenantId || null,
                    speakingTimes: {},
                    statsInterval: null,
                    timer:         null,
                    timerTimeout:  null,
                });
                console.log(`📦 Room ${roomId} created — creator: ${name} (${userId})`);
            }

            const room = rooms.get(roomId);
            getOrCreatePeer(roomId, socket.id);
            room.usersInRoom.set(socket.id, { userId, name });

            try {
                await Room.findOneAndUpdate(
                    { roomId },
                    { $addToSet: { participants: userId }, isActive: true },
                    { upsert: false }
                );
            } catch (dbErr) {
                console.error("MongoDB sync (join) error:", dbErr.message);
            }

            console.log(`✅ ${name} (${userId}) joined room ${roomId} (${room.peers.size} peers)`);

            // isCreator is userId-based so it works correctly across multiple tabs
            const isCreator = room.creatorUserId === userId;


            callback({
                rtpCapabilities: room.router.rtpCapabilities,
                isCreator,
                myUserId: userId,
                myName:   name,
                timerState: room.timer || null,
            });

            socket.to(roomId).emit("new-peer", { peerId: socket.id, userId, name });
            io.to(roomId).emit("peers-list", { peers: buildPeersList(room) });
        } catch (err) {
            console.error("join-room error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("end-room", async () => {
        const currentRoomId = socket.roomId;
        if (!currentRoomId || !rooms.has(currentRoomId)) return;

        const room = rooms.get(currentRoomId);
        const requestingUserId = socket.user?.id;

        if (room.creatorUserId !== requestingUserId) {
            console.warn(`⚠️  Non-creator ${socket.id} attempted to end room ${currentRoomId}`);
            return;
        }

        console.log(`🔚 Creator ${socket.id} ended room ${currentRoomId}`);
        io.to(currentRoomId).emit("room-closed", { reason: "Host ended the meeting" });

        closeRoom(room);
        rooms.delete(currentRoomId);

        try {
            await Room.findOneAndUpdate(
                { roomId: currentRoomId },
                { isActive: false, participants: [] }
            );
            console.log(`📝 Room ${currentRoomId} expired in MongoDB (creator ended call)`);
        } catch (dbErr) {
            console.error("MongoDB sync (end-room) error:", dbErr.message);
        }
    });

    socket.on("create-send-transport", async (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Not in a room" });

            const transport = await createWebRtcTransport(room.router);
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            peer.sendTransport = transport;

            console.log(`📤 Send transport created for ${socket.id}: ${transport.id}`);
            callback({
                id:             transport.id,
                iceParameters:  transport.iceParameters,
                iceCandidates:  transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (err) {
            console.error("create-send-transport error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("create-recv-transport", async (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Not in a room" });

            const transport = await createWebRtcTransport(room.router);
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            peer.recvTransport = transport;

            console.log(`📥 Recv transport created for ${socket.id}: ${transport.id}`);
            callback({
                id:             transport.id,
                iceParameters:  transport.iceParameters,
                iceCandidates:  transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (err) {
            console.error("create-recv-transport error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("connect-transport", async ({ transportId, dtlsParameters }, callback) => {
        try {
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            if (!peer) return callback({ error: "Peer not found" });

            let transport = null;
            if (peer.sendTransport?.id === transportId) transport = peer.sendTransport;
            if (peer.recvTransport?.id === transportId) transport = peer.recvTransport;
            if (!transport) return callback({ error: "Transport not found" });

            await transport.connect({ dtlsParameters });
            console.log(`🔗 Transport ${transportId} connected for ${socket.id}`);
            callback({ connected: true });
        } catch (err) {
            console.error("connect-transport error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("produce", async ({ transportId, kind, rtpParameters, appData }, callback) => {
        try {
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            if (!peer?.sendTransport || peer.sendTransport.id !== transportId) {
                return callback({ error: "Send transport not found" });
            }

            const producer = await peer.sendTransport.produce({ kind, rtpParameters, appData });
            peer.producers.set(producer.id, producer);
            console.log(`🎬 Producer created for ${socket.id}: ${producer.id} (${kind})`);

            producer.on("transportclose", () => {
                producer.close();
                peer.producers.delete(producer.id);
            });

            callback({ id: producer.id });

            const room     = rooms.get(socket.roomId);
            const identity = room?.usersInRoom.get(socket.id) || { userId: socket.id, name: "Unknown" };
            socket.to(socket.roomId).emit("new-producer", {
                producerId: producer.id,
                peerId:     socket.id,
                userId:     identity.userId,
                name:       identity.name,
                kind,
                appData,
            });
        } catch (err) {
            console.error("produce error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("consume", async ({ producerId, rtpCapabilities }, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Room not found" });

            const peer = getOrCreatePeer(socket.roomId, socket.id);
            if (!peer?.recvTransport) return callback({ error: "Recv transport not found" });

            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                return callback({ error: "Cannot consume" });
            }

            // Start paused — client calls resume-consumer after setup
            const consumer = await peer.recvTransport.consume({ producerId, rtpCapabilities, paused: true });
            peer.consumers.set(consumer.id, consumer);

            consumer.on("transportclose", () => {
                consumer.close();
                peer.consumers.delete(consumer.id);
            });
            consumer.on("producerclose", () => {
                consumer.close();
                peer.consumers.delete(consumer.id);
                socket.emit("producer-closed", { producerId });
            });

            console.log(`👁️ Consumer created for ${socket.id}: ${consumer.id} (${consumer.kind})`);
            callback({
                id:            consumer.id,
                producerId,
                kind:          consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        } catch (err) {
            console.error("consume error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("resume-consumer", async ({ consumerId }, callback) => {
        try {
            const peer     = getOrCreatePeer(socket.roomId, socket.id);
            const consumer = peer?.consumers.get(consumerId);
            if (!consumer) return callback({ error: "Consumer not found" });

            await consumer.resume();
            console.log(`▶️ Consumer ${consumerId} resumed for ${socket.id}`);
            callback({ resumed: true });
        } catch (err) {
            console.error("resume-consumer error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("get-producers", (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Room not found" });

            const producers = [];
            for (const [peerId, peer] of room.peers) {
                if (peerId === socket.id) continue;
                const identity = room.usersInRoom.get(peerId) || { userId: peerId, name: "Unknown" };
                for (const [producerId, producer] of peer.producers) {
                    producers.push({
                        producerId,
                        peerId,
                        userId:  identity.userId,
                        name:    identity.name,
                        kind:    producer.kind,
                        appData: producer.appData,
                    });
                }
            }
            callback({ producers });
        } catch (err) {
            console.error("get-producers error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("send-message", ({ message }, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback?.({ error: "Room not found" });

            const identity = room.usersInRoom.get(socket.id) || { userId: socket.id, name: "Unknown" };
            const chatMessage = {
                peerId:    socket.id,
                userId:    identity.userId,
                name:      identity.name,
                message,
                timestamp: Date.now(),
            };

            room.chatHistory.push(chatMessage);
            if (room.chatHistory.length > MAX_CHAT_HISTORY) {
                room.chatHistory = room.chatHistory.slice(-MAX_CHAT_HISTORY);
            }

            io.to(socket.roomId).emit("new-message", chatMessage);
            callback?.({ sent: true });
        } catch (err) {
            console.error("send-message error:", err);
            callback?.({ error: err.message });
        }
    });

    socket.on("get-chat-history", (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Room not found" });
            callback({ messages: room.chatHistory });
        } catch (err) {
            console.error("get-chat-history error:", err);
            callback({ error: err.message });
        }
    });

    socket.on("raise-hand", ({ raised }) => {
        if (!socket.roomId) return;
        const room     = rooms.get(socket.roomId);
        const identity = room?.usersInRoom.get(socket.id) || { userId: socket.id, name: "Unknown" };
        io.to(socket.roomId).emit("hand-raised", {
            peerId: socket.id,
            userId: identity.userId,
            name:   identity.name,
            raised,
        });
    });

    // ── Live Reactions ──────────────────────────────────────────────────────
    const VALID_REACTIONS = new Set(["confetti", "clap", "laugh", "heart", "fire", "thumbsup"]);

    socket.on("send-reaction", ({ type }) => {
        if (!socket.roomId || !VALID_REACTIONS.has(type)) return;
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const identity = room.usersInRoom.get(socket.id) || { userId: socket.id, name: "Unknown" };

        // Rate limit: max 1 reaction per REACTION_RATE_LIMIT_MS per socket
        const now = Date.now();
        if (socket._lastReaction && now - socket._lastReaction < REACTION_RATE_LIMIT_MS) return;
        socket._lastReaction = now;

        io.to(socket.roomId).emit("reaction", {
            type,
            peerId:    socket.id,
            userId:    identity.userId,
            name:      identity.name,
            timestamp: now,
        });
    });

    // ── Speaking Time Tracker ────────────────────────────────────────────────
    socket.on("speaking-update", ({ durationMs }) => {
        if (!socket.roomId) return;
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const userId = socket.user?.id;
        if (!userId || typeof durationMs !== "number" || durationMs < 0) return;

        // Cap per-update to prevent abuse; accumulate on the server
        room.speakingTimes[userId] = (room.speakingTimes[userId] || 0) + Math.min(durationMs, MAX_SPEAKING_UPDATE_MS);

        // Start broadcasting stats interval lazily (once per room)
        if (!room.statsInterval) {
            const rid = socket.roomId;
            room.statsInterval = setInterval(() => {
                const r = rooms.get(rid);
                if (!r) return;

                // Attach display names to each userId entry
                const stats = {};
                for (const [uid, ms] of Object.entries(r.speakingTimes)) {
                    let name = "Unknown";
                    for (const [, info] of r.usersInRoom) {
                        if (info.userId === uid) { name = info.name; break; }
                    }
                    stats[uid] = { ms, name };
                }
                io.to(rid).emit("speaking-stats", { stats });
            }, SPEAKING_STATS_BROADCAST_MS);
        }
    });

    // ── Shared Focus Timer ────────────────────────────────────────────────
    socket.on("start-timer", ({ durationMs }) => {
        if (!socket.roomId) return;
        const room = rooms.get(socket.roomId);
        if (!room) return;

        // Only the creator can start a timer
        if (room.creatorUserId !== socket.user?.id) return;

        // Validate duration bounds
        if (typeof durationMs !== "number" || durationMs < TIMER_MIN_MS || durationMs > TIMER_MAX_MS) return;

        if (room.timerTimeout) clearTimeout(room.timerTimeout);

        const startedAt = Date.now();
        room.timer = { durationMs, startedAt };
        io.to(socket.roomId).emit("timer-sync", room.timer);

        // Auto-expire when duration elapses
        const rid = socket.roomId;
        room.timerTimeout = setTimeout(() => {
            const r = rooms.get(rid);
            if (r) { r.timer = null; r.timerTimeout = null; }
            io.to(rid).emit("timer-ended");
        }, durationMs);
    });

    socket.on("stop-timer", () => {
        if (!socket.roomId) return;
        const room = rooms.get(socket.roomId);
        if (!room) return;

        // Only the creator can stop
        if (room.creatorUserId !== socket.user?.id) return;

        if (room.timerTimeout) clearTimeout(room.timerTimeout);
        room.timer        = null;
        room.timerTimeout = null;
        io.to(socket.roomId).emit("timer-ended");
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
        console.log(`🔴 User disconnected: ${socket.id}`);

        if (!socket.roomId || !rooms.has(socket.roomId)) return;

        const currentRoomId        = socket.roomId;
        const room                 = rooms.get(currentRoomId);
        const disconnectingUserId  = socket.user?.id;

        // Check userId (not socketId) so it works even if creator had multiple tabs open
        const isLastCreatorTab =
            room.creatorUserId === disconnectingUserId &&
            Array.from(room.usersInRoom.values()).filter((u) => u.userId === disconnectingUserId).length <= 1;

        if (isLastCreatorTab) {
            console.log(`🔚 Creator ${socket.user?.name} (last tab) disconnected — closing room ${currentRoomId}`);
            socket.to(currentRoomId).emit("room-closed", { reason: "Host left the meeting" });

            closeRoom(room);
            rooms.delete(currentRoomId);

            try {
                await Room.findOneAndUpdate(
                    { roomId: currentRoomId },
                    { isActive: false, participants: [] }
                );
                console.log(`📝 Room ${currentRoomId} expired in MongoDB (creator disconnected)`);
            } catch (dbErr) {
                console.error("MongoDB sync (creator-disconnect) error:", dbErr.message);
            }
            return;
        }

        // Read identity BEFORE deleting — needed for the peer-left broadcast
        const leftIdentity = room.usersInRoom.get(socket.id) || { userId: socket.id, name: "Unknown" };
        const peer         = room.peers.get(socket.id);

        if (peer) {
            peer.producers.forEach((producer) => producer.close());
            peer.consumers.forEach((consumer) => consumer.close());
            peer.sendTransport?.close();
            peer.recvTransport?.close();
            room.peers.delete(socket.id);
        }

        socket.to(currentRoomId).emit("peer-left", {
            peerId: socket.id,
            userId: leftIdentity.userId,
        });

        room.usersInRoom.delete(socket.id);
        io.to(currentRoomId).emit("peers-list", { peers: buildPeersList(room) });

        if (room.peers.size === 0) {
            // Last participant left — clean up the room entirely
            closeRoom(room);
            rooms.delete(currentRoomId);
            console.log(`🗑️ Room ${currentRoomId} deleted (empty)`);

            try {
                await Room.findOneAndUpdate(
                    { roomId: currentRoomId },
                    { isActive: false, participants: [] }
                );
                console.log(`📝 Room ${currentRoomId} marked inactive in MongoDB`);
            } catch (dbErr) {
                console.error("MongoDB sync (delete) error:", dbErr.message);
            }
        } else {
            try {
                await Room.findOneAndUpdate(
                    { roomId: currentRoomId },
                    { $pull: { participants: disconnectingUserId } }
                );
            } catch (dbErr) {
                console.error("MongoDB sync (leave) error:", dbErr.message);
            }
        }
    });
});

// ── Server startup ──────────────────────────────────────────────────────────

async function startServer() {
    const MONGO_URI = process.env.MONGO_URI;
    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log("✅ Connected to MongoDB");
        } catch (err) {
            console.error("❌ MongoDB connection failed:", err.message);
        }
    } else {
        console.warn("⚠️  No MONGO_URI set — auth features disabled");
    }

    await createWorker();

    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
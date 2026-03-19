const mediasoup = require("mediasoup");
const express = require("express");
const http = require("http");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});

app.get("/", (req, res) => {
    res.send("Server is running");
});

// ── Mediasoup worker ────────────────────────────────────────────────────────
let worker;

async function createWorker() {
    worker = await mediasoup.createWorker({
        rtcMinPort: 20000,
        rtcMaxPort: 20200,
    });
    console.log("✅ Mediasoup Worker created");

    worker.on("died", () => {
        console.error("❌ Mediasoup worker died – exiting");
        process.exit(1);
    });
}

// ── Codec support ───────────────────────────────────────────────────────────
const mediaCodecs = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
    },
];

// ── Room state ──────────────────────────────────────────────────────────────
// rooms Map structure:
// roomId -> {
//   router: Router,
//   peers: Map<socketId, {
//     sendTransport: Transport | null,
//     recvTransport: Transport | null,
//     producers: Map<producerId, Producer>,
//     consumers: Map<consumerId, Consumer>,
//   }>
// }
const rooms = new Map();

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

// Helper to create a WebRTC transport with common options
async function createWebRtcTransport(router) {
    const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: "127.0.0.1" }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000,
    });

    transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "closed") {
            transport.close();
        }
    });

    return transport;
}

// ── Socket.IO events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Track which room this socket is in
    socket.roomId = null;

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  JOIN ROOM                                                          │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("join-room", async (roomId, callback) => {
        try {
            if (!worker) {
                return callback({ error: "Server not ready" });
            }

            socket.join(roomId);
            socket.roomId = roomId;

            // Create room + router if needed
            if (!rooms.has(roomId)) {
                const router = await worker.createRouter({ mediaCodecs });
                rooms.set(roomId, {
                    router,
                    peers: new Map(),
                });
                console.log(`📦 Room ${roomId} created`);
            }

            const room = rooms.get(roomId);
            getOrCreatePeer(roomId, socket.id);

            console.log(`✅ Socket ${socket.id} joined room ${roomId} (${room.peers.size} peers)`);

            // Send RTP capabilities back so client can load the Device
            callback({
                rtpCapabilities: room.router.rtpCapabilities,
            });

            // Notify existing peers that someone new joined
            socket.to(roomId).emit("new-peer", { peerId: socket.id });
        } catch (err) {
            console.error("join-room error:", err);
            callback({ error: err.message });
        }
    });

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  CREATE SEND TRANSPORT                                              │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("create-send-transport", async (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Not in a room" });

            const transport = await createWebRtcTransport(room.router);
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            peer.sendTransport = transport;

            console.log(`📤 Send transport created for ${socket.id}: ${transport.id}`);

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (err) {
            console.error("create-send-transport error:", err);
            callback({ error: err.message });
        }
    });

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  CREATE RECV TRANSPORT                                              │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("create-recv-transport", async (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Not in a room" });

            const transport = await createWebRtcTransport(room.router);
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            peer.recvTransport = transport;

            console.log(`📥 Recv transport created for ${socket.id}: ${transport.id}`);

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (err) {
            console.error("create-recv-transport error:", err);
            callback({ error: err.message });
        }
    });

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  CONNECT TRANSPORT (works for both send and recv)                   │
    // └──────────────────────────────────────────────────────────────────────┘
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

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  PRODUCE (client sends media → server)                             │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("produce", async ({ transportId, kind, rtpParameters }, callback) => {
        try {
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            if (!peer?.sendTransport || peer.sendTransport.id !== transportId) {
                return callback({ error: "Send transport not found" });
            }

            const producer = await peer.sendTransport.produce({ kind, rtpParameters });
            peer.producers.set(producer.id, producer);

            console.log(`🎬 Producer created for ${socket.id}: ${producer.id} (${kind})`);

            producer.on("transportclose", () => {
                producer.close();
                peer.producers.delete(producer.id);
            });

            callback({ id: producer.id });

            // Notify all other peers in the room to consume this new producer
            socket.to(socket.roomId).emit("new-producer", {
                producerId: producer.id,
                peerId: socket.id,
                kind,
            });
        } catch (err) {
            console.error("produce error:", err);
            callback({ error: err.message });
        }
    });

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  CONSUME (server sends remote media → client)                      │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("consume", async ({ producerId, rtpCapabilities }, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Room not found" });

            const peer = getOrCreatePeer(socket.roomId, socket.id);
            if (!peer?.recvTransport) return callback({ error: "Recv transport not found" });

            // Check if the router can consume
            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                return callback({ error: "Cannot consume" });
            }

            const consumer = await peer.recvTransport.consume({
                producerId,
                rtpCapabilities,
                paused: true, // start paused, client resumes after setup
            });

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
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        } catch (err) {
            console.error("consume error:", err);
            callback({ error: err.message });
        }
    });

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  RESUME CONSUMER                                                    │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("resume-consumer", async ({ consumerId }, callback) => {
        try {
            const peer = getOrCreatePeer(socket.roomId, socket.id);
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

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  GET EXISTING PRODUCERS (when a new peer joins)                     │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("get-producers", (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Room not found" });

            const producers = [];
            for (const [peerId, peer] of room.peers) {
                if (peerId === socket.id) continue; // skip self
                for (const [producerId, producer] of peer.producers) {
                    producers.push({
                        producerId,
                        peerId,
                        kind: producer.kind,
                    });
                }
            }

            callback({ producers });
        } catch (err) {
            console.error("get-producers error:", err);
            callback({ error: err.message });
        }
    });

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  DISCONNECT                                                         │
    // └──────────────────────────────────────────────────────────────────────┘
    socket.on("disconnect", () => {
        console.log(`🔴 User disconnected: ${socket.id}`);

        if (socket.roomId && rooms.has(socket.roomId)) {
            const room = rooms.get(socket.roomId);
            const peer = room.peers.get(socket.id);

            if (peer) {
                // Close all producers
                peer.producers.forEach((producer) => producer.close());
                // Close all consumers
                peer.consumers.forEach((consumer) => consumer.close());
                // Close transports
                peer.sendTransport?.close();
                peer.recvTransport?.close();
                // Remove peer
                room.peers.delete(socket.id);
            }

            // Notify others
            socket.to(socket.roomId).emit("peer-left", { peerId: socket.id });

            // Clean up empty rooms
            if (room.peers.size === 0) {
                room.router.close();
                rooms.delete(socket.roomId);
                console.log(`🗑️ Room ${socket.roomId} deleted (empty)`);
            }
        }
    });
});

// ── Start server ────────────────────────────────────────────────────────────
createWorker()
    .then(() => {
        server.listen(5000, () => {
            console.log("🚀 Server running on http://localhost:5000");
        });
    })
    .catch((err) => {
        console.error("Failed to create mediasoup worker:", err);
    });
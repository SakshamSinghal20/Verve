//  Verve – Main Server File
//  Handles: HTTP API, Socket.IO signaling, Mediasoup WebRTC

// Load environment variables from .env file into process.env
require("dotenv").config();

const mediasoup = require("mediasoup");   // WebRTC media server
const express = require("express");     // HTTP framework
const http = require("http");        // Node's built-in HTTP module
const cors = require("cors");        // Cross-Origin Resource Sharing
const mongoose = require("mongoose");    // MongoDB connection + models
const { v4: uuidv4 } = require("uuid");  // Unique ID generator (available for future use)
const authRoutes = require("./routes/auth");                       // REST routes: /api/auth/register, /api/auth/login
const { socketAuthMiddleware } = require("./middleware/auth");     // JWT check for socket connections

// ── Create the Express app and wrap it in a raw HTTP server
// We need the raw HTTP server because Socket.IO needs to attach to it directly
const app = express();
const server = http.createServer(app);

// ── Config from .env (with sensible defaults for local dev)
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"; // where the React app runs
const SERVER_IP = process.env.SERVER_IP || "127.0.0.1";             // IP that Mediasoup advertises to clients
const PORT = process.env.PORT || 5000;                    // port this server listens on

// ── Express middleware
app.use(cors({ origin: FRONTEND_URL }));  // only allow requests from our frontend URL
app.use(express.json());                  // parse incoming JSON request bodies

// Simple health-check route — visiting http://localhost:5000 confirms the server is up
app.get("/", (req, res) => {
    res.send("Server is running");
});

// Mount auth REST routes under /api/auth
// e.g. POST /api/auth/register, POST /api/auth/login
app.use("/api/auth", authRoutes);

// ── Socket.IO setup
// Attach Socket.IO to the same HTTP server as Express so they share one port
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"],
    },
});

// Require a valid JWT token before any socket can connect
// If no token is present, the socket is still allowed in as a guest (see middleware/auth.js)
io.use(socketAuthMiddleware);

// ── Mediasoup worker          
// The worker is a low-level child process that handles all the actual media routing (RTP/RTCP)
let worker;

async function createWorker() {
    worker = await mediasoup.createWorker({
        rtcMinPort: 20000,  // UDP port range for media packets — make sure firewall allows these
        rtcMaxPort: 20200,
    });
    console.log("✅ Mediasoup Worker created");

    // If the worker crashes for some reason, exit the whole server
    // In production you'd want to restart the worker instead of exiting
    worker.on("died", () => {
        console.error("❌ Mediasoup worker died – exiting");
        process.exit(1);
    });
}

// ── Media codecs 
// These are the audio/video formats the server supports.
// Browsers negotiate which one to use during the WebRTC handshake.
const mediaCodecs = [
    {
        kind: "audio",
        mimeType: "audio/opus",  // Opus = high-quality, low-latency audio codec
        clockRate: 48000,         // 48kHz sample rate
        channels: 2,             // stereo
    },
    {
        kind: "video",
        mimeType: "video/VP8",   // VP8 = widely supported WebRTC video codec
        clockRate: 90000,
    },
];

// ── In-memory room storage
// We don't store rooms in the database — they're destroyed when everyone leaves.
//
// Structure:
// rooms (Map)
//  └─ roomId
//      ├─ router      → Mediasoup Router (one per room, handles codec negotiation)
//      ├─ chatHistory → Array of messages (capped at 200)
//      └─ peers (Map)
//          └─ socketId
//              ├─ sendTransport → Transport for this peer's outgoing media
//              ├─ recvTransport → Transport for this peer's incoming media
//              ├─ producers     → Map of media tracks this peer is sending
//              └─ consumers     → Map of media tracks this peer is receiving
const rooms = new Map();

// Look up a peer inside a room, or create one with empty state if they're new
function getOrCreatePeer(roomId, socketId) {
    const room = rooms.get(roomId);
    if (!room) return null; // room doesn't exist yet

    if (!room.peers.has(socketId)) {
        // First time we're seeing this socket in this room — set up blank state
        room.peers.set(socketId, {
            sendTransport: null,
            recvTransport: null,
            producers: new Map(), // tracks this peer is sending to the server
            consumers: new Map(), // tracks this peer is receiving from the server
        });
    }
    return room.peers.get(socketId);
}

// ── WebRTC Transport factory 
// A "transport" is the tunnel between the server and a single client.
// Every peer needs two: one for sending (upload) and one for receiving (download).
async function createWebRtcTransport(router) {
    const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: SERVER_IP }], // listen on all interfaces; tell the client to connect to SERVER_IP
        enableUdp: true,    // UDP is preferred — lower latency
        enableTcp: true,    // TCP as a fallback when UDP is blocked
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000, // start at ~1 Mbps, Mediasoup will adjust automatically
    });

    // Clean up the transport object when the DTLS connection closes
    transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "closed") {
            transport.close();
        }
    });

    return transport;
}

//  Socket.IO Events
//  All real-time signaling between clients and server happens here.
io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // We'll track which room this socket is in so we can look it up easily
    socket.roomId = null;

    //   JOIN ROOM                                                          
    //   Client calls this first when they navigate to a room URL.          
    //   Server sets up the room if it doesn't exist and returns RTP        
    //   capabilities (which the client needs to load its Mediasoup Device).
    socket.on("join-room", async (roomId, callback) => {
        try {
            // Mediasoup must be ready before any room can be created
            if (!worker) {
                return callback({ error: "Server not ready" });
            }

            // Add this socket to Socket.IO's room (for group broadcasting later)
            socket.join(roomId);
            socket.roomId = roomId;

            // If this is the very first person joining, create the room and its router
            if (!rooms.has(roomId)) {
                const router = await worker.createRouter({ mediaCodecs });
                rooms.set(roomId, {
                    router,
                    peers: new Map(),
                    chatHistory: [], // starts empty
                });
                console.log(`📦 Room ${roomId} created`);
            }

            const room = rooms.get(roomId);
            getOrCreatePeer(roomId, socket.id); // register this peer in the room

            console.log(`✅ Socket ${socket.id} joined room ${roomId} (${room.peers.size} peers)`);

            // Return the router's RTP capabilities — the client uses this to load its Mediasoup Device
            callback({
                rtpCapabilities: room.router.rtpCapabilities,
            });

            // Tell everyone else that a new person just joined
            socket.to(roomId).emit("new-peer", { peerId: socket.id });

            // Send the full list of peer IDs in the room to everyone (including the new joiner)
            const peerIds = Array.from(room.peers.keys());
            io.to(roomId).emit("peers-list", { peers: peerIds });
        } catch (err) {
            console.error("join-room error:", err);
            callback({ error: err.message });
        }
    });

    //   CREATE SEND TRANSPORT                                              
    //   Creates the "upload" pipe — for this client to send their camera   
    //   and mic to the server. Returns ICE/DTLS params to the client.      
    socket.on("create-send-transport", async (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Not in a room" });

            const transport = await createWebRtcTransport(room.router);
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            peer.sendTransport = transport; // save so we can use it when the client produces

            console.log(`📤 Send transport created for ${socket.id}: ${transport.id}`);

            // Send back the parameters the client needs to connect on its end
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

    //   CREATE RECV TRANSPORT                                              
    //   Creates the "download" pipe — for this client to receive other     
    //   people's media from the server.                                    
    socket.on("create-recv-transport", async (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Not in a room" });

            const transport = await createWebRtcTransport(room.router);
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            peer.recvTransport = transport; // save so we can create consumers on it later

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

    //   CONNECT TRANSPORT                                                  
    //   Finalizes the DTLS (encryption) handshake for either send or recv  
    //   transport. The client sends its DTLS certificate fingerprint and   
    //   the server uses it to establish a secure channel.                  
    socket.on("connect-transport", async ({ transportId, dtlsParameters }, callback) => {
        try {
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            if (!peer) return callback({ error: "Peer not found" });

            // Figure out which transport (send or recv) this connection is for
            let transport = null;
            if (peer.sendTransport?.id === transportId) transport = peer.sendTransport;
            if (peer.recvTransport?.id === transportId) transport = peer.recvTransport;

            if (!transport) return callback({ error: "Transport not found" });

            // Complete the DTLS handshake — after this, media can flow
            await transport.connect({ dtlsParameters });
            console.log(`🔗 Transport ${transportId} connected for ${socket.id}`);
            callback({ connected: true });
        } catch (err) {
            console.error("connect-transport error:", err);
            callback({ error: err.message });
        }
    });

    //   PRODUCE                                                            
    //   Client wants to send a media track (camera video or mic audio).   
    //   Server creates a Producer and notifies all other peers so they     
    //   can subscribe (consume) to it.                                     
    socket.on("produce", async ({ transportId, kind, rtpParameters }, callback) => {
        try {
            const peer = getOrCreatePeer(socket.roomId, socket.id);

            // Make sure the send transport exists and matches
            if (!peer?.sendTransport || peer.sendTransport.id !== transportId) {
                return callback({ error: "Send transport not found" });
            }

            // Create the producer — this is the server-side representation of the client's track
            const producer = await peer.sendTransport.produce({ kind, rtpParameters });
            peer.producers.set(producer.id, producer); // save for later lookup

            console.log(`🎬 Producer created for ${socket.id}: ${producer.id} (${kind})`);

            // If the underlying transport closes, clean up the producer too
            producer.on("transportclose", () => {
                producer.close();
                peer.producers.delete(producer.id);
            });

            // Tell the client what ID was assigned to this producer
            callback({ id: producer.id });

            // Notify everyone else in the room so they can start consuming this stream
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

    //   CONSUME                                                            
    //   Client wants to receive someone else's media stream.              
    //   Server checks compatibility, creates a Consumer, and gives the     
    //   client the parameters it needs to play the stream.                 
    socket.on("consume", async ({ producerId, rtpCapabilities }, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Room not found" });

            const peer = getOrCreatePeer(socket.roomId, socket.id);
            if (!peer?.recvTransport) return callback({ error: "Recv transport not found" });

            // Check that this client's device can actually decode the producer's codec
            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                return callback({ error: "Cannot consume" });
            }

            // Create the consumer — this is the server-side representation of the incoming stream
            // We start it paused; the client will resume it once it's set up on its end
            const consumer = await peer.recvTransport.consume({
                producerId,
                rtpCapabilities,
                paused: true, // start paused — client calls resume-consumer after setup
            });

            peer.consumers.set(consumer.id, consumer);

            // When the transport closes (e.g. disconnection), clean up the consumer
            consumer.on("transportclose", () => {
                consumer.close();
                peer.consumers.delete(consumer.id);
            });

            // When the original sender stops their stream, tell this client about it
            consumer.on("producerclose", () => {
                consumer.close();
                peer.consumers.delete(consumer.id);
                socket.emit("producer-closed", { producerId });
            });

            console.log(`👁️ Consumer created for ${socket.id}: ${consumer.id} (${consumer.kind})`);

            // Send back everything the client needs to receive and play the stream
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

    //   RESUME CONSUMER                                                    
    //   Tells the server to start flowing media for a consumer that was    
    //   created in a paused state. Client calls this after it's ready.     
    socket.on("resume-consumer", async ({ consumerId }, callback) => {
        try {
            const peer = getOrCreatePeer(socket.roomId, socket.id);
            const consumer = peer?.consumers.get(consumerId);
            if (!consumer) return callback({ error: "Consumer not found" });

            await consumer.resume(); // actual media starts flowing now
            console.log(`▶️ Consumer ${consumerId} resumed for ${socket.id}`);
            callback({ resumed: true });
        } catch (err) {
            console.error("resume-consumer error:", err);
            callback({ error: err.message });
        }
    });

    //   GET PRODUCERS                                                      
    //   Called by a newly joined peer to discover all streams that were    
    //   already active in the room before they arrived.                    
    socket.on("get-producers", (_, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback({ error: "Room not found" });

            const producers = [];

            // Loop through every peer and collect their producers
            for (const [peerId, peer] of room.peers) {
                if (peerId === socket.id) continue; // skip yourself — no point consuming your own stream

                for (const [producerId, producer] of peer.producers) {
                    producers.push({
                        producerId,
                        peerId,
                        kind: producer.kind, // "audio" or "video"
                    });
                }
            }

            callback({ producers });
        } catch (err) {
            console.error("get-producers error:", err);
            callback({ error: err.message });
        }
    });

    //   CHAT                                                               
    //   Client sends a new chat message
    socket.on("send-message", ({ message }, callback) => {
        try {
            const room = rooms.get(socket.roomId);
            if (!room) return callback?.({ error: "Room not found" });

            const chatMessage = {
                peerId: socket.id,   // who sent it
                message,                // the text
                timestamp: Date.now(),  // when it was sent
            };

            // Keep history in memory, capped at 200 so we don't use too much RAM
            room.chatHistory.push(chatMessage);
            if (room.chatHistory.length > 200) {
                room.chatHistory = room.chatHistory.slice(-200); // keep only the last 200
            }

            // Broadcast to everyone in the room (including the sender so their UI confirms it)
            io.to(socket.roomId).emit("new-message", chatMessage);

            callback?.({ sent: true });
        } catch (err) {
            console.error("send-message error:", err);
            callback?.({ error: err.message });
        }
    });

    // Client requests chat history when they first join (so they don't miss earlier messages)
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

    //   RAISE HAND                                                         
    //   Simple broadcast — no server state needed.                         
    //   Just relay the raised/lowered status to everyone in the room.      
    socket.on("raise-hand", ({ raised }) => {
        if (!socket.roomId) return;
        // Forward to all peers in the room (including the sender)
        io.to(socket.roomId).emit("hand-raised", {
            peerId: socket.id,
            raised,             // true = hand up, false = hand down
        });
    });

    //   DISCONNECT                                                         
    //   Fires automatically when a client closes the tab, loses internet, 
    //   or clicks "Leave". Cleans up all their resources and notifies      
    //   remaining peers.                                                    
    socket.on("disconnect", () => {
        console.log(`🔴 User disconnected: ${socket.id}`);

        if (socket.roomId && rooms.has(socket.roomId)) {
            const room = rooms.get(socket.roomId);
            const peer = room.peers.get(socket.id);

            if (peer) {
                // Close all media objects — this stops the RTP streams and frees memory
                peer.producers.forEach((producer) => producer.close());
                peer.consumers.forEach((consumer) => consumer.close());
                peer.sendTransport?.close();
                peer.recvTransport?.close();

                // Remove this peer from the room
                room.peers.delete(socket.id);
            }

            // Tell the remaining peers that this person left
            socket.to(socket.roomId).emit("peer-left", { peerId: socket.id });

            // Broadcast the updated list so UI peer counts stay accurate
            const peerIds = Array.from(room.peers.keys());
            io.to(socket.roomId).emit("peers-list", { peers: peerIds });

            // If the room is now empty, destroy it to free all resources
            if (room.peers.size === 0) {
                room.router.close(); // close the Mediasoup router
                rooms.delete(socket.roomId);
                console.log(`🗑️ Room ${socket.roomId} deleted (empty)`);
            }
        }
    });
});

//  Server Startup
//  Boot order matters: DB → Mediasoup → HTTP listener
async function startServer() {
    // Connect to MongoDB (only if MONGO_URI is set in .env)
    const MONGO_URI = process.env.MONGO_URI;
    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log("✅ Connected to MongoDB");
        } catch (err) {
            // Log the error but don't crash — the app can still run without auth features
            console.error("❌ MongoDB connection failed:", err.message);
        }
    } else {
        console.warn("⚠️  No MONGO_URI set — auth features disabled");
    }

    // Start the Mediasoup worker (must be done before any rooms are created)
    await createWorker();

    // Start listening for HTTP and Socket.IO connections
    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

// Start everything — if anything throws during boot, log it and exit
startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
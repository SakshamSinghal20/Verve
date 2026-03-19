const mediasoup = require("mediasoup");
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        method: ["GET", "POST"],
    },
});
app.get("/", (req, res) => {
    res.send("Server is running");
});

let worker;
const room = new Map();
async function createWorker() {
    worker = await mediasoup.createWorker({
        rtcMinPort: 20000,
        rtcMaxPort: 20200,
    });
    console.log("Mediasoup Worker created");

    worker.on("died", () => {
        console.error("Mediasoup worker died");
        process.exit(1);
    });

}

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
    }
];

io.on("connection", (socket) => {
    console.log("user connected", socket.id);

    socket.on("create-transport", async () => {
        const router = socket.router;
        if (!router) {
            console.error(`[${socket.id}] create-transport called before joining a room`);
            return;
        }

        const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        console.log(`[${socket.id}] Transport created: ${transport.id}`);

        socket.emit("transport-created", {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });

        socket.transport = transport;
    });

    socket.on("join-room", async (roomId) => {


        socket.join(roomId);

        if (!room.has(roomId)) {
            const router = await worker.createRouter({ mediaCodecs });

            room.set(roomId, {
                router,
                peers: []
            });
        }

        const router = room.get(roomId).router;
        socket.router = router; // store so create-transport can access it

        socket.emit("router-rtp-capabilities", router.rtpCapabilities);
        socket.emit("room-joined", roomId);

        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("connect-transport", async ({ transportId, dtlsParameters }) => {
        try {
            const transport = socket.transport;
            if (!transport || transport.id !== transportId) {
                return socket.emit("transport-connect-error", "Transport not found");
            }
            await transport.connect({ dtlsParameters });
            console.log(`[${socket.id}] Transport connected`);
            socket.emit("transport-connected");
        } catch (err) {
            console.error("connect-transport error:", err);
            socket.emit("transport-connect-error", err.message);
        }
    });

    socket.on("produce", async ({ transportId, kind, rtpParameters }) => {
        try {
            const transport = socket.transport;
            if (!transport || transport.id !== transportId) {
                return socket.emit("produce-error", "Transport not found");
            }
            const producer = await transport.produce({ kind, rtpParameters });
            console.log(`[${socket.id}] Producer created: ${producer.id} (${kind})`);
            socket.emit("producer-created", { id: producer.id });
        } catch (err) {
            console.error("produce error:", err);
            socket.emit("produce-error", err.message);
        }
    });

    socket.on("disconnect", () => {
        console.log("user-disconnected:", socket.id);
    });
});

(async () => {
    await createWorker();
})();

server.listen(5000, () => {
    console.log("server running on port 5000")
})
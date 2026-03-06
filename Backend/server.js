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

        socket.emit("router-rtp-capabilities", router.rtpCapabilities);

        console.log(`Socket ${socket.id} joined room ${roomId}`);
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
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
    },
});

io.on("connection", (socket) => {
    console.log("user connected", socket.id);

    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);

        socket.to(roomId).emit("user-joined", socket.id);
        socket.emit("room-joined", roomId)
    });
    socket.on("disconnect", () => {
        console.log("user-disconnected:", socket.id);
    });
});

server.listen(5000, () => {
    console.log("server running on port 5000")
})
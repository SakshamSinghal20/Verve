const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);

server.listen(5000, () => {
    console.log("server running on port 5000")
})

const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        orgin: "https://localhost:5173",
    },
});

io.on("connection", (socket) => {
    console.log("user connected", socket.id);
})
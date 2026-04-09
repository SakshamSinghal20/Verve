const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Room = require("../models/Room");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const ROOM_ID_REGEX = /^[a-zA-Z0-9-]{3,32}$/;

// POST /api/rooms/instant
router.post("/instant", authMiddleware, async (req, res) => {
    try {
        const roomId = uuidv4().replace(/-/g, "").slice(0, 8);

        const room = await Room.findOneAndUpdate(
            { roomId },
            { 
                createdBy: req.user.id, 
                isActive: true, 
                participants: [] 
            },
            { upsert: true, new: true }
        );

        console.log(`📦 Instant room created: ${roomId} by ${req.user.email}`);

        res.status(201).json({
            roomId: room.roomId,
            created: true,
        });
    } catch (err) {
        console.error("Instant room error:", err);
        res.status(500).json({ error: "Failed to create room" });
    }
});

// POST /api/rooms
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId || typeof roomId !== "string") {
            return res.status(400).json({ error: "Room ID is required" });
        }

        const trimmed = roomId.trim().toLowerCase();

        if (!ROOM_ID_REGEX.test(trimmed)) {
            return res.status(400).json({
                error: "Room ID must be 3–32 alphanumeric characters or hyphens",
            });
        }

        const existing = await Room.findOne({ roomId: trimmed, isActive: true });
        if (existing) {
            return res.status(409).json({ error: "Room ID already in use" });
        }

        const room = await Room.findOneAndUpdate(
            { roomId: trimmed },
            { 
                createdBy: req.user.id, 
                isActive: true, 
                participants: [] 
            },
            { upsert: true, new: true }
        );

        console.log(`📦 Custom room created: ${trimmed} by ${req.user.email}`);

        res.status(201).json({
            roomId: room.roomId,
            created: true,
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Room ID already in use" });
        }
        console.error("Create room error:", err);
        res.status(500).json({ error: "Failed to create room" });
    }
});

// POST /api/rooms/join
router.post("/join", authMiddleware, async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId || typeof roomId !== "string") {
            return res.status(400).json({ error: "Room ID is required" });
        }

        const trimmed = roomId.trim().toLowerCase();

        const room = await Room.findOne({ roomId: trimmed, isActive: true });
        if (!room) {
            return res.status(404).json({ error: "Room does not exist" });
        }

        res.json({
            roomId: room.roomId,
            participants: room.participants.length,
        });
    } catch (err) {
        console.error("Join room error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;

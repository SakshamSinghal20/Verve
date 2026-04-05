const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Room = require("../models/Room");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Regex: 3–32 chars, alphanumeric + hyphens only
const ROOM_ID_REGEX = /^[a-zA-Z0-9-]{3,32}$/;

// ── Instant Meeting ─────────────────────────────────────────────────────────
// POST /api/rooms/instant
// Auth required. Generates a guaranteed-unique short room ID.
router.post("/instant", authMiddleware, async (req, res) => {
    try {
        // Generate a short 8-char ID from UUID (collision-safe enough for this scale)
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

// ── Create Custom Room ──────────────────────────────────────────────────────
// POST /api/rooms
// Auth required. User provides their own roomId.
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

        // Check if an active room with this ID already exists
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
        // Handle MongoDB duplicate key race condition
        if (err.code === 11000) {
            return res.status(409).json({ error: "Room ID already in use" });
        }
        console.error("Create room error:", err);
        res.status(500).json({ error: "Failed to create room" });
    }
});

// ── Join Room ───────────────────────────────────────────────────────────────
// POST /api/rooms/join
// No auth required (guests can join via link).
// Validates the room exists and is active before the client navigates.
router.post("/join", async (req, res) => {
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

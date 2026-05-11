const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
    {
        roomId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            default: null,
        },
        participants: {
            type: [String], // socket IDs of currently connected users
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Set by tenant room creation. Null means no expiry (regular rooms).
        expiresAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Index for fast lookups by roomId + active status
roomSchema.index({ roomId: 1, isActive: 1 });

// TTL index: MongoDB auto-removes documents once expiresAt is reached.
// Only fires when expiresAt is a real Date; null values are ignored.
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model("Room", roomSchema);


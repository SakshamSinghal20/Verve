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
            required: true,
        },
        participants: {
            type: [String], // socket IDs of currently connected users
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Index for fast lookups by roomId + active status
roomSchema.index({ roomId: 1, isActive: 1 });

module.exports = mongoose.model("Room", roomSchema);

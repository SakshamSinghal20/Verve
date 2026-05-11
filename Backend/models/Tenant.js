const mongoose = require("mongoose");
const crypto = require("crypto");

const tenantSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        apiKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        logo: {
            type: String,
            default: null,
        },
        primaryColor: {
            type: String,
            default: "#7c3aed",
            match: /^#[0-9a-fA-F]{6}$/,
        },
        // Domains allowed to embed rooms (e.g. ["https://acme.com"]).
        // Empty array means all origins are allowed (open embed).
        allowedOrigins: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

/**
 * Generates a cryptographically secure API key prefixed with "vk_".
 */
tenantSchema.statics.generateApiKey = function () {
    return "vk_" + crypto.randomBytes(32).toString("hex");
};

module.exports = mongoose.model("Tenant", tenantSchema);

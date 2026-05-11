const express = require("express");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const Tenant = require("../models/Tenant");
const Room = require("../models/Room");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// ── Default room TTL for tenant-created rooms: 24 hours ────────────────────
const TENANT_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

// ── Reusable tenant API-key authentication middleware ───────────────────────
// Exported so other routes/modules can reuse it without duplicating logic.
async function tenantAuth(req, res, next) {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
        return res.status(401).json({ error: "API key required (x-api-key header)" });
    }

    try {
        const tenant = await Tenant.findOne({ apiKey });
        if (!tenant) {
            return res.status(401).json({ error: "Invalid API key" });
        }
        req.tenant = tenant;
        next();
    } catch (err) {
        console.error("Tenant auth middleware error:", err);
        res.status(500).json({ error: "Server error" });
    }
}

// ── POST /api/tenant/register — Create a new tenant ────────────────────────

router.post("/register", async (req, res) => {
    try {
        const { name, logo, primaryColor, allowedOrigins } = req.body;

        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return res.status(400).json({ error: "Tenant name is required (min 2 characters)" });
        }

        // Validate allowedOrigins entries if provided
        const origins = Array.isArray(allowedOrigins)
            ? allowedOrigins.filter((o) => typeof o === "string" && o.startsWith("http"))
            : [];

        const apiKey = Tenant.generateApiKey();
        const tenant = await Tenant.create({
            name: name.trim(),
            apiKey,
            logo: logo || null,
            primaryColor: primaryColor || undefined,
            allowedOrigins: origins,
        });

        console.log(`🏢 Tenant created: ${tenant.name} (${tenant._id})`);

        res.status(201).json({
            tenantId: tenant._id,
            name: tenant.name,
            apiKey,             // returned once — store it securely
            logo: tenant.logo,
            primaryColor: tenant.primaryColor,
            allowedOrigins: tenant.allowedOrigins,
        });
    } catch (err) {
        console.error("Tenant register error:", err);
        if (err.name === "ValidationError") {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Failed to create tenant" });
    }
});

// ── POST /api/tenant/rooms — Create a room for the tenant ──────────────────

router.post("/rooms", tenantAuth, async (req, res) => {
    try {
        // Optional custom TTL in hours (1–168); defaults to 24 h
        const { ttlHours } = req.body;
        const ttlMs = (Number.isFinite(ttlHours) && ttlHours >= 1 && ttlHours <= 168)
            ? ttlHours * 60 * 60 * 1000
            : TENANT_ROOM_TTL_MS;

        const roomId = uuidv4().replace(/-/g, "").slice(0, 12);
        const tenantId = req.tenant._id;
        const expiresAt = new Date(Date.now() + ttlMs);

        await Room.create({
            roomId,
            tenantId,
            expiresAt,
            isActive: true,
            participants: [],
        });

        const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
        const embedUrl = `${FRONTEND_URL}/embed/${roomId}`;

        console.log(`📦 Tenant room created: ${roomId} for tenant ${req.tenant.name} (expires ${expiresAt.toISOString()})`);

        res.status(201).json({
            roomId,
            embedUrl,
            tenantId: String(tenantId),
            expiresAt: expiresAt.toISOString(),
        });
    } catch (err) {
        console.error("Tenant room creation error:", err);
        res.status(500).json({ error: "Failed to create room" });
    }
});

// ── POST /api/tenant/rooms/:roomId/token — Generate versioned embed JWT ─────

router.post("/rooms/:roomId/token", tenantAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { guestName, role } = req.body;

        if (!guestName || typeof guestName !== "string" || guestName.trim().length < 1) {
            return res.status(400).json({ error: "guestName is required" });
        }

        const validRoles = ["host", "participant"];
        const assignedRole = validRoles.includes(role) ? role : "participant";

        // Verify room exists, belongs to this tenant, and is not expired
        const room = await Room.findOne({ roomId, tenantId: req.tenant._id, isActive: true });
        if (!room) {
            return res.status(404).json({ error: "Room not found or does not belong to this tenant" });
        }
        if (room.expiresAt && room.expiresAt < new Date()) {
            return res.status(410).json({ error: "Room has expired" });
        }

        const guestId = `guest_${uuidv4().replace(/-/g, "").slice(0, 8)}`;

        // version: 1 — required for backward-compatible token format upgrades (constraint 3)
        const token = jwt.sign(
            {
                version:   1,
                tenantId:  String(req.tenant._id),
                roomId,
                role:      assignedRole,
                guestId,
                guestName: guestName.trim(),
            },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
        const embedUrl = `${FRONTEND_URL}/embed/${roomId}?token=${token}`;

        res.json({ token, embedUrl, guestId });
    } catch (err) {
        console.error("Token generation error:", err);
        res.status(500).json({ error: "Failed to generate token" });
    }
});

// ── GET /api/tenant/branding/:tenantId — Public branding (no auth) ──────────
// Used by the embed page to fetch tenant logo/color before joining.

router.get("/branding/:tenantId", async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.tenantId)
            .select("name logo primaryColor allowedOrigins")
            .lean();

        if (!tenant) {
            return res.status(404).json({ error: "Tenant not found" });
        }

        // Validate referrer/origin against allowedOrigins (constraint 7)
        // Only enforced when the tenant has a non-empty allowedOrigins list.
        if (tenant.allowedOrigins && tenant.allowedOrigins.length > 0) {
            const requestOrigin = req.headers.origin || req.headers.referer || "";
            const originMatches = tenant.allowedOrigins.some((allowed) =>
                requestOrigin.startsWith(allowed)
            );
            if (!originMatches) {
                return res.status(403).json({ error: "Origin not permitted for this tenant" });
            }
        }

        res.json({
            name:           tenant.name,
            logo:           tenant.logo,
            primaryColor:   tenant.primaryColor,
            allowedOrigins: tenant.allowedOrigins,
        });
    } catch (err) {
        console.error("Branding fetch error:", err);
        res.status(500).json({ error: "Failed to fetch branding" });
    }
});

// ── PUT /api/tenant/branding — Update tenant branding ───────────────────────

router.put("/branding", tenantAuth, async (req, res) => {
    try {
        const { name, logo, primaryColor, allowedOrigins } = req.body;
        const updates = {};

        if (name && typeof name === "string" && name.trim().length >= 2) {
            updates.name = name.trim();
        }
        if (logo !== undefined) updates.logo = logo;
        if (primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
            updates.primaryColor = primaryColor;
        }
        if (Array.isArray(allowedOrigins)) {
            updates.allowedOrigins = allowedOrigins.filter(
                (o) => typeof o === "string" && o.startsWith("http")
            );
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields to update" });
        }

        const tenant = await Tenant.findByIdAndUpdate(req.tenant._id, updates, { new: true })
            .select("name logo primaryColor allowedOrigins");

        res.json({
            name:           tenant.name,
            logo:           tenant.logo,
            primaryColor:   tenant.primaryColor,
            allowedOrigins: tenant.allowedOrigins,
        });
    } catch (err) {
        console.error("Branding update error:", err);
        res.status(500).json({ error: "Failed to update branding" });
    }
});

module.exports = router;
module.exports.tenantAuth = tenantAuth;  // exported for reuse in other route files

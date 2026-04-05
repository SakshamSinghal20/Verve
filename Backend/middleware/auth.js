const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "verve-dev-secret-change-me";

/**
 * Express middleware: verifies JWT from Authorization header.
 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = header.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

/**
 * Socket.io middleware: verifies JWT from handshake auth.
 * Rejects unauthenticated connections — a valid token is required.
 * Always fetches the user from DB to guarantee a fresh, correct name.
 */
async function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Always look up the user from DB to get the current name
        // This prevents stale JWTs (missing or outdated name) from
        // causing "Peer xxxxx" labels instead of real names
        const dbUser = await User.findById(decoded.id).select("name email").lean();
        if (!dbUser) {
            return next(new Error("User not found — please register or log in again"));
        }

        socket.user = {
            id: decoded.id,
            name: dbUser.name,      // always fresh from DB
            email: dbUser.email,
        };
        next();
    } catch (err) {
        next(new Error("Invalid or expired token"));
    }
}

module.exports = { authMiddleware, socketAuthMiddleware, JWT_SECRET };

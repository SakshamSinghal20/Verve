const jwt = require("jsonwebtoken");

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
 * Allows unauthenticated connections for backward compat.
 */
function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) {
        socket.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        next();
    } catch {
        next(new Error("Authentication error"));
    }
}

module.exports = { authMiddleware, socketAuthMiddleware, JWT_SECRET };

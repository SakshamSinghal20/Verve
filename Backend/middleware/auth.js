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
 * Rejects unauthenticated connections — a valid token is required.
 */
function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;   // { id, name, email, iat, exp }
        next();
    } catch {
        next(new Error("Invalid or expired token"));
    }
}

module.exports = { authMiddleware, socketAuthMiddleware, JWT_SECRET };

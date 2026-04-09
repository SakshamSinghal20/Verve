const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "verve-dev-secret-change-me";

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

// Always fetches user from DB to guarantee a fresh name — prevents stale JWTs
// from causing "Peer xxxxx" labels instead of real names
async function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const dbUser = await User.findById(decoded.id).select("name email").lean();
        if (!dbUser) {
            return next(new Error("User not found — please register or log in again"));
        }

        socket.user = {
            id: decoded.id,
            name: dbUser.name,
            email: dbUser.email,
        };
        next();
    } catch (err) {
        next(new Error("Invalid or expired token"));
    }
}

module.exports = { authMiddleware, socketAuthMiddleware, JWT_SECRET };

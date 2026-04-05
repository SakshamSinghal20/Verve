// socket.js — Socket.IO factory
// Each call to createSocket() returns a BRAND NEW, disconnected socket.
// Call socket.connect() to connect, socket.disconnect() to tear down.
// This prevents tabs from sharing a single socket and interfering with each other.

import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Creates a new Socket.IO instance for a room session.
 * The socket is NOT connected until you call socket.connect().
 */
export function createSocket() {
    const token = localStorage.getItem("verve-token");
    return io(API_URL, {
        autoConnect: false,   // don't connect automatically — Room.jsx controls lifecycle
        auth: token ? { token } : {},
    });
}

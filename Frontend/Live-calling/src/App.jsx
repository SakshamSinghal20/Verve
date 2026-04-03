//  App.jsx — Landing page + socket setup
//  All socket + room navigation logic preserved exactly.
//  Only visual markup is updated.

import { io } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// Shared socket — created once, exported for Room.jsx
const token = localStorage.getItem("verve-token");
export const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
    auth: token ? { token } : {},
});

// SVG icons (inline — no icon library dep)
const IconVideo = () => (
    <svg className="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
);

const IconArrow = () => (
    <svg className="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
);

function App() {
    const [roomId, setRoomId]       = useState("");
    const [connected, setConnected] = useState(false);
    const [toast, setToast]         = useState(null); // { msg, hide }
    const navigate = useNavigate();

    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem("verve-user");
        return stored ? JSON.parse(stored) : null;
    });

    // ── Generate random 8-char room ID ──────────────────────────
    function generateRoomId() {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let id = "";
        for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    }

    const handleCreate = () => navigate(`/room/${generateRoomId()}`);

    const handleJoin = () => {
        const trimmed = roomId.trim();
        if (!trimmed) return;
        navigate(`/room/${trimmed}`);
    };

    const handleKeyDown = (e) => { if (e.key === "Enter") handleJoin(); };

    const handleLogout = () => {
        localStorage.removeItem("verve-token");
        localStorage.removeItem("verve-user");
        setUser(null);
        window.location.reload();
    };

    // ── Toast helper ────────────────────────────────────────────
    function showToast(msg) {
        setToast({ msg, hide: false });
        setTimeout(() => setToast((t) => t ? { ...t, hide: true } : null), 2200);
        setTimeout(() => setToast(null), 2500);
    }

    // ── Socket connection tracking ──────────────────────────────
    useEffect(() => {
        socket.on("connect",    () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));
        return () => { socket.off("connect"); socket.off("disconnect"); };
    }, []);

    return (
        <div className="landing-container">
            {/* Animated background orbs */}
            <div className="landing-bg">
                <div className="landing-orb landing-orb-1" />
                <div className="landing-orb landing-orb-2" />
                <div className="landing-orb landing-orb-3" />
            </div>

            {/* Nav */}
            <nav className="landing-nav">
                <span className="nav-logo">Verve</span>
                {!user ? (
                    <div className="nav-auth">
                        <Link to="/login"    className="nav-link">Sign In</Link>
                        <Link to="/register" className="nav-link nav-link-primary">Register</Link>
                    </div>
                ) : (
                    <div className="nav-auth">
                        <span className="nav-link" style={{ color: "var(--text)", cursor: "default" }}>
                            👋 {user.name}
                        </span>
                        <button className="btn-logout" onClick={handleLogout}>Logout</button>
                    </div>
                )}
            </nav>

            {/* Hero content */}
            <div className="landing-content">
                <div className="hero-badge">
                    <span className="hero-badge-dot" />
                    No downloads required
                </div>

                <h1 className="hero-brand">Verve</h1>

                <p className="hero-headline">
                    Simple, fast video meetings
                </p>

                <p className="hero-subtext">
                    No downloads. Just share a link and start talking — crystal-clear calls that work everywhere.
                </p>

                {/* Action card */}
                <div className="hero-card">
                    {user && (
                        <div className="user-badge" style={{ marginBottom: "1rem" }}>
                            <span className="user-name">Signed in as {user.name}</span>
                            <button className="btn-logout" onClick={handleLogout}>Logout</button>
                        </div>
                    )}

                    <button className="btn-create" onClick={handleCreate} id="btn-create-meeting">
                        <IconVideo />
                        Create New Room
                    </button>

                    <div className="divider">
                        <span>or join existing</span>
                    </div>

                    <div className="join-group">
                        <input
                            type="text"
                            placeholder="Enter Room ID…"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            onKeyDown={handleKeyDown}
                            id="input-room-id"
                        />
                        <button
                            className="btn-join"
                            onClick={handleJoin}
                            disabled={!roomId.trim()}
                            id="btn-join-meeting"
                        >
                            <span>Join</span>
                            <IconArrow />
                        </button>
                    </div>
                </div>
            </div>

            {/* Feature highlights */}
            <div className="features-row">
                <div className="feature-card">
                    <span className="feature-icon">🔒</span>
                    <span className="feature-label">End-to-end encrypted</span>
                </div>
                <div className="feature-card">
                    <span className="feature-icon">⚡</span>
                    <span className="feature-label">Ultra-low latency</span>
                </div>
                <div className="feature-card">
                    <span className="feature-icon">💬</span>
                    <span className="feature-label">Built-in chat</span>
                </div>
                <div className="feature-card">
                    <span className="feature-icon">🖥️</span>
                    <span className="feature-label">Screen sharing</span>
                </div>
            </div>

            {/* Footer - connection indicator */}
            <div className="landing-footer">
                <div className={`connection-indicator ${connected ? "online" : "offline"}`}>
                    <span className="dot" />
                    {connected ? "Connected to server" : "Connecting…"}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.hide ? "hide" : ""}`}>
                    <span className="toast-icon">✓</span>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

export default App;
//  App.jsx — Landing page
//  Three distinct room flows: Instant Meeting, Custom Room, Join Existing

import "./App.css";
import { useEffect, useState, useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// ── SVG icons ───────────────────────────────────────────────
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

const IconPlus = () => (
    <svg className="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const IconLock = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const IconZap = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
);
const IconChat = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);
const IconMonitor = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
);

const IconChevron = ({ open }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
         style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}>
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

function App() {
    const [roomId, setRoomId]               = useState("");
    const [customRoomId, setCustomRoomId]   = useState("");
    const [connected, setConnected]         = useState(false);
    const [toast, setToast]                 = useState(null);
    const [customOpen, setCustomOpen]       = useState(false);
    const [loadingInstant, setLoadingInstant] = useState(false);
    const [loadingCustom, setLoadingCustom]   = useState(false);
    const [loadingJoin, setLoadingJoin]       = useState(false);
    const navigate = useNavigate();

    const { user, loading, logout } = useContext(AuthContext);

    // ── Helper: get auth header ─────────────────────────────
    function authHeaders() {
        const t = localStorage.getItem("verve-token");
        return t ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` }
                 : { "Content-Type": "application/json" };
    }

    // ── Toast helper ────────────────────────────────────────
    function showToast(msg, type = "success") {
        setToast({ msg, type, hide: false });
        setTimeout(() => setToast((t) => t ? { ...t, hide: true } : null), 2800);
        setTimeout(() => setToast(null), 3100);
    }

    // ── 1) Instant Meeting ──────────────────────────────────
    async function handleInstant() {
        if (!user) { navigate("/login"); return; }
        setLoadingInstant(true);
        try {
            const res = await fetch(`${API_URL}/api/rooms/instant`, {
                method: "POST",
                headers: authHeaders(),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create room");
            navigate(`/room/${data.roomId}`);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoadingInstant(false);
        }
    }

    // ── 2) Create Custom Room ───────────────────────────────
    async function handleCustomCreate() {
        if (!user) { navigate("/login"); return; }
        const trimmed = customRoomId.trim().toLowerCase();
        if (!trimmed) return;
        setLoadingCustom(true);
        try {
            const res = await fetch(`${API_URL}/api/rooms`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ roomId: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create room");
            navigate(`/room/${data.roomId}`);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoadingCustom(false);
        }
    }

    // ── 3) Join Existing Room ───────────────────────────────
    async function handleJoin() {
        if (!user) { navigate("/login"); return; }
        const trimmed = roomId.trim().toLowerCase();
        if (!trimmed) return;
        setLoadingJoin(true);
        try {
            const res = await fetch(`${API_URL}/api/rooms/join`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ roomId: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Room not found");
            navigate(`/room/${data.roomId}`);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoadingJoin(false);
        }
    }

    const handleJoinKeyDown = (e) => { if (e.key === "Enter") handleJoin(); };
    const handleCustomKeyDown = (e) => { if (e.key === "Enter") handleCustomCreate(); };

    // ── Socket connection tracking — not needed here (socket lives in Room.jsx) ──

    if (loading) {
        return (
            <div className="landing-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ color: 'var(--text)', fontSize: '1.2rem' }}>Loading Verve...</div>
            </div>
        );
    }

    return (
        <div className="landing-container">

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
                        <button className="btn-logout" onClick={logout}>Logout</button>
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
                            <button className="btn-logout" onClick={logout}>Logout</button>
                        </div>
                    )}

                    {/* ── Section 1: Instant Meeting ── */}
                    <button
                        className="btn-create"
                        onClick={handleInstant}
                        disabled={loadingInstant}
                        id="btn-create-meeting"
                    >
                        <IconVideo />
                        {loadingInstant ? "Creating…" : "Start Instant Meeting"}
                    </button>

                    {/* ── Section 2: Custom Room (collapsible) ── */}
                    <button
                        className="btn-custom-toggle"
                        onClick={() => setCustomOpen(!customOpen)}
                        type="button"
                    >
                        <IconPlus />
                        <span>Create with Custom ID</span>
                        <IconChevron open={customOpen} />
                    </button>

                    <div className={`custom-section ${customOpen ? "open" : ""}`}>
                        <div className="custom-group">
                            <input
                                type="text"
                                placeholder="Enter custom room ID…"
                                value={customRoomId}
                                onChange={(e) => setCustomRoomId(e.target.value)}
                                onKeyDown={handleCustomKeyDown}
                                id="input-custom-room-id"
                            />
                            <button
                                className="btn-custom-create"
                                onClick={handleCustomCreate}
                                disabled={!customRoomId.trim() || loadingCustom}
                                id="btn-custom-create"
                            >
                                {loadingCustom ? "Creating…" : "Create"}
                            </button>
                        </div>
                        <p className="custom-hint">3–32 characters, letters, numbers, and hyphens only</p>
                    </div>

                    {/* ── Section 3: Join Existing Room ── */}
                    <div className="divider">
                        <span>or join existing</span>
                    </div>

                    <div className="join-group">
                        <input
                            type="text"
                            placeholder="Enter Room ID…"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            onKeyDown={handleJoinKeyDown}
                            id="input-room-id"
                        />
                        <button
                            className="btn-join"
                            onClick={handleJoin}
                            disabled={!roomId.trim() || loadingJoin}
                            id="btn-join-meeting"
                        >
                            <span>{loadingJoin ? "Joining…" : "Join"}</span>
                            <IconArrow />
                        </button>
                    </div>
                </div>
            </div>

            {/* Feature highlights */}
            <div className="features-row">
                <div className="feature-card">
                    <span className="feature-icon"><IconLock /></span>
                    <span className="feature-label">End-to-end encrypted</span>
                </div>
                <div className="feature-card">
                    <span className="feature-icon"><IconZap /></span>
                    <span className="feature-label">Ultra-low latency</span>
                </div>
                <div className="feature-card">
                    <span className="feature-icon"><IconChat /></span>
                    <span className="feature-label">Built-in chat</span>
                </div>
                <div className="feature-card">
                    <span className="feature-icon"><IconMonitor /></span>
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
                <div className={`toast ${toast.type === "error" ? "toast-error" : ""} ${toast.hide ? "hide" : ""}`}>
                    <span className="toast-icon">{toast.type === "error" ? "✕" : "✓"}</span>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

export default App;
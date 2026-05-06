import "./App.css";
import { useEffect, useState, useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
    IconVideo, IconArrow, IconPlus,
    IconLock, IconZap, IconChat, IconMonitor, IconChevron,
} from "./components/Icons";
import ParticleField from "./components/ParticleField";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function App() {
    const [roomId,       setRoomId]       = useState("");
    const [customRoomId, setCustomRoomId] = useState("");
    const [connected,    setConnected]    = useState(false);
    const [toast,        setToast]        = useState(null);
    const [customOpen,   setCustomOpen]   = useState(false);

    const [loadingInstant, setLoadingInstant] = useState(false);
    const [loadingCustom,  setLoadingCustom]  = useState(false);
    const [loadingJoin,    setLoadingJoin]    = useState(false);

    const navigate = useNavigate();
    const { user, loading, logout } = useContext(AuthContext);

    // Check server reachability on mount
    useEffect(() => {
        fetch(`${API_URL}/`)
            .then((res) => { if (res.ok) setConnected(true); })
            .catch(() => setConnected(false));
    }, []);

    function authHeaders() {
        const t = localStorage.getItem("verve-token");
        return t
            ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` }
            : { "Content-Type": "application/json" };
    }

    function showToast(msg, type = "success") {
        setToast({ msg, type, hide: false });
        setTimeout(() => setToast((t) => t ? { ...t, hide: true } : null), 2800);
        setTimeout(() => setToast(null), 3100);
    }

    async function handleInstant() {
        if (!user) { navigate("/login"); return; }
        setLoadingInstant(true);
        try {
            const res  = await fetch(`${API_URL}/api/rooms/instant`, { method: "POST", headers: authHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create room");
            navigate(`/room/${data.roomId}`);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoadingInstant(false);
        }
    }

    async function handleCustomCreate() {
        if (!user) { navigate("/login"); return; }
        const trimmed = customRoomId.trim().toLowerCase();
        if (!trimmed) return;
        setLoadingCustom(true);
        try {
            const res  = await fetch(`${API_URL}/api/rooms`, {
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

    async function handleJoin() {
        if (!user) { navigate("/login"); return; }
        const trimmed = roomId.trim().toLowerCase();
        if (!trimmed) return;
        setLoadingJoin(true);
        try {
            const res  = await fetch(`${API_URL}/api/rooms/join`, {
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

    const handleJoinKeyDown   = (e) => { if (e.key === "Enter") handleJoin(); };
    const handleCustomKeyDown = (e) => { if (e.key === "Enter") handleCustomCreate(); };

    if (loading) {
        return (
            <div className="landing-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                <div style={{ color: "var(--text)", fontSize: "1.2rem" }}>Loading Verve...</div>
            </div>
        );
    }

    return (
        <div className="landing-container">
            <ParticleField />
            <div className="landing-grain" aria-hidden="true" />
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

            <div className="landing-content">
                <div className="hero-badge">
                    <span className="hero-badge-dot" />
                    No downloads required
                </div>

                <h1 className="hero-brand">Verve</h1>

                <p className="hero-headline">Simple, fast video meetings</p>

                <p className="hero-subtext">
                    No downloads. Just share a link and start talking — crystal-clear calls that work everywhere.
                </p>

                <div
                    className="hero-card"
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
                    }}
                >
                    {user && (
                        <div className="user-badge" style={{ marginBottom: "1rem" }}>
                            <span className="user-name">Signed in as {user.name}</span>
                        </div>
                    )}

                    <button
                        className="btn-create"
                        onClick={handleInstant}
                        disabled={loadingInstant}
                        id="btn-create-meeting"
                    >
                        <IconVideo className="btn-icon-svg" />
                        {loadingInstant ? "Creating…" : "Start Instant Meeting"}
                    </button>

                    <button
                        className="btn-custom-toggle"
                        onClick={() => setCustomOpen(!customOpen)}
                        type="button"
                    >
                        <IconPlus className="btn-icon-svg" />
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
                            <IconArrow className="btn-icon-svg" />
                        </button>
                    </div>
                </div>
            </div>

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

            <div className="landing-footer">
                <div className={`connection-indicator ${connected ? "online" : "offline"}`}>
                    <span className="dot" />
                    {connected ? "Connected to server" : "Connecting…"}
                </div>
            </div>

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
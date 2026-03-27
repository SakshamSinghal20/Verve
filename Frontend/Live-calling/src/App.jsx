import { io } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// Connect socket with auth token if available
const token = localStorage.getItem("verve-token");
export const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
    auth: token ? { token } : {},
});

function App() {
    const [roomId, setRoomId] = useState("");
    const [connected, setConnected] = useState(false);
    const navigate = useNavigate();

    // Auth state
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem("verve-user");
        return stored ? JSON.parse(stored) : null;
    });

    function generateRoomId() {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let id = "";
        for (let i = 0; i < 8; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    const handleCreate = () => {
        const newRoomId = generateRoomId();
        navigate(`/room/${newRoomId}`);
    };

    const handleJoin = () => {
        const trimmed = roomId.trim();
        if (!trimmed) return;
        navigate(`/room/${trimmed}`);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleJoin();
    };

    const handleLogout = () => {
        localStorage.removeItem("verve-token");
        localStorage.removeItem("verve-user");
        setUser(null);
        window.location.reload();
    };

    useEffect(() => {
        socket.on("connect", () => {
            console.log("Connected to server:", socket.id);
            setConnected(true);
        });

        socket.on("disconnect", () => {
            console.log("Disconnected from server");
            setConnected(false);
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
        };
    }, []);

    return (
        <div className="landing-container">
            <div className="landing-card">
                <h1 className="landing-title">Verve</h1>
                <p className="landing-subtitle">
                    Crystal-clear video calls, instantly.
                </p>

                {user && (
                    <div className="user-badge">
                        <span className="user-name">👋 {user.name}</span>
                        <button className="btn-logout" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                )}

                <div className="landing-actions">
                    <button
                        className="btn-create"
                        onClick={handleCreate}
                        id="btn-create-meeting"
                    >
                        <span className="btn-icon">✦</span>
                        Create Meeting
                    </button>

                    <div className="divider">
                        <span>or</span>
                    </div>

                    <div className="join-group">
                        <input
                            type="text"
                            placeholder="Enter Room ID to join…"
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
                            Join →
                        </button>
                    </div>
                </div>

                <div className="landing-footer">
                    <div className={`connection-indicator ${connected ? "online" : "offline"}`}>
                        <span className="dot" />
                        {connected ? "Connected to server" : "Connecting…"}
                    </div>

                    {!user && (
                        <div className="auth-links">
                            <Link to="/login">Sign In</Link>
                            <span className="auth-sep">•</span>
                            <Link to="/register">Register</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
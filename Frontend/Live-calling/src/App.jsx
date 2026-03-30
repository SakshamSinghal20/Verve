//  App.jsx — Landing page
//
//  What this file does:
//   - Shows the Verve home screen (create/join a meeting)
//   - Creates the shared Socket.IO connection (exported for Room.jsx)
//   - Handles logged-in user display and logout

import { io } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// ── Create the Socket.IO connection when the app first loads
// This runs ONCE and the socket is shared across the whole app via the export below.
// If there's a JWT token in localStorage (from a previous login), we send it along
// so the server can verify the user's identity on the socket connection.
const token = localStorage.getItem("verve-token");
export const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
    auth: token ? { token } : {}, // attach token if logged in, empty object if guest
});

function App() {
    const [roomId, setRoomId] = useState("");       // value of the "join by ID" input
    const [connected, setConnected] = useState(false);  // tracks socket connection status
    const navigate = useNavigate();

    // Load the logged-in user from localStorage.
    // We use a lazy initializer so it only runs once on mount, not on every re-render.
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem("verve-user");
        return stored ? JSON.parse(stored) : null; // null = not logged in
    });

    // ── Generate a random 8-character room ID 
    // Uses only lowercase letters and numbers so it's easy to share verbally
    function generateRoomId() {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let id = "";
        for (let i = 0; i < 8; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    // ── Create a new meeting 
    // Generates a fresh room ID and navigates straight into the room
    const handleCreate = () => {
        const newRoomId = generateRoomId();
        navigate(`/room/${newRoomId}`);
    };

    // ── Join an existing meeting 
    // Takes the ID the user typed and opens that room
    const handleJoin = () => {
        const trimmed = roomId.trim();
        if (!trimmed) return; // do nothing if the input is empty
        navigate(`/room/${trimmed}`);
    };

    // Allow pressing Enter in the input field instead of clicking the Join button
    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleJoin();
    };

    // ── Logout 
    // Remove saved credentials and reload the page so the socket reconnects as a guest
    const handleLogout = () => {
        localStorage.removeItem("verve-token");
        localStorage.removeItem("verve-user");
        setUser(null);
        window.location.reload(); // reload so the socket is re-created without the token
    };

    // ── Track socket connection status
    // Used to show the green/grey dot indicator at the bottom of the card
    useEffect(() => {
        socket.on("connect", () => {
            console.log("Connected to server:", socket.id);
            setConnected(true);
        });

        socket.on("disconnect", () => {
            console.log("Disconnected from server");
            setConnected(false);
        });

        // Remove listeners when this component unmounts to avoid memory leaks
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

                {/* Show the user's name and logout button if they're signed in */}
                {user && (
                    <div className="user-badge">
                        <span className="user-name">👋 {user.name}</span>
                        <button className="btn-logout" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                )}

                <div className="landing-actions">
                    {/* "Create Meeting" — generates a new room ID and enters it immediately */}
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

                    {/* "Join by ID" — user pastes or types a room ID someone shared with them */}
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
                            disabled={!roomId.trim()} // keep disabled until something is typed
                            id="btn-join-meeting"
                        >
                            Join →
                        </button>
                    </div>
                </div>

                <div className="landing-footer">
                    {/* Connection indicator — shows whether the socket is connected to the server */}
                    <div className={`connection-indicator ${connected ? "online" : "offline"}`}>
                        <span className="dot" />
                        {connected ? "Connected to server" : "Connecting…"}
                    </div>

                    {/* Only show auth links when the user is not logged in */}
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
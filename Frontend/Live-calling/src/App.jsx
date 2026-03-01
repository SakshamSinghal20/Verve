import { io } from "socket.io-client";
import './App.css';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const socket = io("http://localhost:5000");

function App() {

  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!roomId) return;
    socket.emit("join-room", roomId);
  };

  useEffect(() => {
    socket.on("room-joined", (roomId) => {
      navigate(`/room/${roomId}`);
    });

    return () => {
      socket.off("room-joined");
    };
  }, [navigate]);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
    });
  }, []);

  return (
    <div className="container">
      <h1>Verve</h1>
      <p className="subtitle">
        Connect instantly with high-quality video calling
      </p>

      <div className="button-group">
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />

        <button className="secondary-btn" onClick={handleJoin}>
          Join the meeting
        </button>
      </div>
    </div>
  );
}

export default App;
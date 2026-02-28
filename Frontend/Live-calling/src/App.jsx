import { io } from "socket.io-client";
import './App.css'
import { useEffect } from "react";

const socket = io("http://localhost:5000");

function App() {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("connected to server:", socket.id);
    });
  }, []);

  return (
    <div className="container">
      <h1>Verve</h1>
      <p className="subtitle">Connect instantly with high-quality video calling</p>
      <div className="button-group">
        <button className="primary-btn">Start the meeting</button>
        <button className="secondary-btn">Join the meeting</button>
      </div>
    </div>
  )
}

export default App

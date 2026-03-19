import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../App";
import * as mediasoupClient from "mediasoup-client";
import "./Room.css";

function Room() {
    const { roomId } = useParams();

    // ── Refs ──────────────────────────────────────────────────────────────────
    const videoRef        = useRef(null);   // <video> element
    const deviceRef       = useRef(null);   // mediasoup Device
    const transportRef    = useRef(null);   // send WebRtcTransport
    const streamRef       = useRef(null);   // local MediaStream
    const producerRef     = useRef(null);   // mediasoup Producer
    const initializedRef  = useRef(false);  // guard against double-init (StrictMode)

    // ── UI state ──────────────────────────────────────────────────────────────
    const [status, setStatus]     = useState("Connecting…");
    const [isMuted, setIsMuted]   = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);

    // ── Main effect ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        console.log("[Room] Joined room:", roomId);

        // Step 1 – receive RTP capabilities → load device → request transport
        socket.on("router-rtp-capabilities", async (rtpCapabilities) => {
            try {
                console.log("[Room] Received RTP capabilities");
                setStatus("Loading device…");

                const device = new mediasoupClient.Device();
                await device.load({ routerRtpCapabilities: rtpCapabilities });
                deviceRef.current = device;
                console.log("[Room] Device loaded");

                // Ask the server to create a WebRTC send transport
                setStatus("Creating transport…");
                socket.emit("create-transport");
            } catch (err) {
                console.error("[Room] Failed to load device:", err);
                setStatus("❌ Device load failed");
            }
        });

        // Step 2 – server returns transport params → create client-side transport
        socket.on("transport-created", async (transportParams) => {
            try {
                console.log("[Room] Transport params received", transportParams);

                const device    = deviceRef.current;
                const transport = device.createSendTransport(transportParams);
                transportRef.current = transport;

                // Step 3 – called by mediasoup internally before first produce()
                transport.on("connect", ({ dtlsParameters }, callback, errback) => {
                    console.log("[Transport] connect event → sending dtlsParameters");
                    socket.emit("connect-transport", {
                        transportId: transport.id,
                        dtlsParameters,
                    });
                    socket.once("transport-connected", callback);
                    socket.once("transport-connect-error", errback);
                });

                // Step 4 – called by mediasoup internally when produce() is called
                transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
                    console.log("[Transport] produce event →", kind);
                    socket.emit("produce", {
                        transportId: transport.id,
                        kind,
                        rtpParameters,
                    });
                    socket.once("producer-created", ({ id }) => callback({ id }));
                    socket.once("produce-error", errback);
                });

                transport.on("connectionstatechange", (state) => {
                    console.log("[Transport] connectionstatechange →", state);
                    if (state === "connected") setStatus("🟢 Live");
                    if (state === "failed")    setStatus("❌ Connection failed");
                    if (state === "closed")    setStatus("🔴 Disconnected");
                });

                // Now capture media and produce
                await startLocalMedia(transport);
            } catch (err) {
                console.error("[Room] Transport setup failed:", err);
                setStatus("❌ Transport setup failed");
            }
        });

        // Cleanup on unmount
        return () => {
            socket.off("router-rtp-capabilities");
            socket.off("transport-created");
            socket.off("transport-connected");
            socket.off("producer-created");

            // Stop all local tracks
            streamRef.current?.getTracks().forEach((t) => t.stop());
            producerRef.current?.close();
            transportRef.current?.close();
            console.log("[Room] Cleaned up");
        };
    }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Capture local media & connect video element ───────────────────────────
    async function startLocalMedia(transport) {
        try {
            setStatus("Requesting camera…");
            console.log("[Media] Requesting getUserMedia…");

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                audio: true,
            });

            streamRef.current = stream;

            // Attach to the <video> element
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            console.log("[Media] Stream acquired, starting produce…");
            setStatus("Producing…");

            const videoTrack = stream.getVideoTracks()[0];
            const producer   = await transport.produce({ track: videoTrack });
            producerRef.current = producer;

            producer.on("trackended",  () => console.warn("[Producer] track ended"));
            producer.on("transportclose", () => console.warn("[Producer] transport closed"));

            console.log("[Media] Producer created:", producer.id);
            // Status will be updated by transport connectionstatechange → "🟢 Live"
        } catch (err) {
            if (
                err.name === "NotAllowedError" ||
                err.name === "PermissionDeniedError"
            ) {
                console.error("[Media] Camera/mic permission denied");
                setStatus("❌ Camera permission denied");
            } else {
                console.error("[Media] getUserMedia / produce error:", err);
                setStatus("❌ Media error: " + err.message);
            }
        }
    }

    // ── Toggle helpers ────────────────────────────────────────────────────────
    function toggleMute() {
        const stream = streamRef.current;
        if (!stream) return;
        stream.getAudioTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setIsMuted((prev) => !prev);
    }

    function toggleCamera() {
        const stream = streamRef.current;
        if (!stream) return;
        stream.getVideoTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setIsCamOff((prev) => !prev);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="room-container">
            {/* Header */}
            <header className="room-header">
                <span className="room-logo">Verve</span>
                <div className="room-id-badge">
                    <span className="room-id-label">Room</span>
                    <span className="room-id-value">{roomId}</span>
                </div>
                <div className={`status-pill ${status.startsWith("🟢") ? "live" : status.startsWith("❌") ? "error" : "pending"}`}>
                    {status}
                </div>
            </header>

            {/* Video stage */}
            <main className="video-stage">
                <div className="video-card">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={isCamOff ? "cam-off" : ""}
                    />
                    {isCamOff && (
                        <div className="cam-off-overlay">
                            <span>📷</span>
                            <p>Camera Off</p>
                        </div>
                    )}
                    <div className="video-label">You (local)</div>
                </div>
            </main>

            {/* Controls */}
            <footer className="room-controls">
                <button
                    className={`ctrl-btn ${isMuted ? "active" : ""}`}
                    onClick={toggleMute}
                    title={isMuted ? "Unmute" : "Mute"}
                    id="btn-toggle-mute"
                >
                    {isMuted ? "🔇" : "🎙️"}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                </button>

                <button
                    className={`ctrl-btn ${isCamOff ? "active" : ""}`}
                    onClick={toggleCamera}
                    title={isCamOff ? "Turn camera on" : "Turn camera off"}
                    id="btn-toggle-camera"
                >
                    {isCamOff ? "📷" : "📹"}
                    <span>{isCamOff ? "Cam On" : "Cam Off"}</span>
                </button>
            </footer>
        </div>
    );
}

export default Room;
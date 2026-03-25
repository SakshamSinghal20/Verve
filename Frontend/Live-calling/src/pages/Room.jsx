import { useEffect, useRef, useState, useCallback } from "react";
// Chat uses socket events: send-message, new-message, get-chat-history
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../App";
import * as mediasoupClient from "mediasoup-client";
import "./Room.css";

function Room() {
    const { roomId } = useParams();
    const navigate = useNavigate();

    // ── Refs ──────────────────────────────────────────────────────────────────
    const localVideoRef    = useRef(null);
    const deviceRef        = useRef(null);
    const sendTransportRef = useRef(null);
    const recvTransportRef = useRef(null);
    const streamRef        = useRef(null);
    const producersRef     = useRef([]);    // local producers
    const consumersRef     = useRef([]);    // remote consumers
    const initializedRef   = useRef(false);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [status, setStatus]             = useState("Connecting…");
    const [isMuted, setIsMuted]           = useState(false);
    const [isCamOff, setIsCamOff]         = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({}); // peerId -> MediaStream
    const [peerCount, setPeerCount]       = useState(0);

    // ── Chat state ───────────────────────────────────────────────────────────
    const [chatOpen, setChatOpen]         = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput]       = useState("");
    const [unreadCount, setUnreadCount]   = useState(0);
    const chatEndRef                      = useRef(null);

    // ── Participants state ────────────────────────────────────────────────────
    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [peersList, setPeersList]               = useState([]);

    // ── Screen sharing state ────────────────────────────────────────────────
    const [isScreenSharing, setIsScreenSharing]   = useState(false);
    const screenProducerRef                       = useRef(null);

    // ── Raise hand state ────────────────────────────────────────────────────
    const [raisedHands, setRaisedHands] = useState({}); // peerId -> true
    const raiseTimerRef                = useRef(null);

    // ── Helper: emit with ack (promisified socket callback) ──────────────────
    function emitAsync(event, data = {}) {
        return new Promise((resolve, reject) => {
            socket.emit(event, data, (response) => {
                if (response?.error) reject(new Error(response.error));
                else resolve(response);
            });
        });
    }

    // ── Consume a remote producer ────────────────────────────────────────────
    const consumeProducer = useCallback(async (producerId, peerId, kind) => {
        try {
            const device = deviceRef.current;
            if (!device) return;

            console.log(`[Room] Consuming ${kind} from peer ${peerId}`);

            const consumerData = await emitAsync("consume", {
                producerId,
                rtpCapabilities: device.rtpCapabilities,
            });

            const recvTransport = recvTransportRef.current;
            if (!recvTransport) {
                console.error("[Room] No recv transport available");
                return;
            }

            const consumer = await recvTransport.consume({
                id: consumerData.id,
                producerId: consumerData.producerId,
                kind: consumerData.kind,
                rtpParameters: consumerData.rtpParameters,
            });

            consumersRef.current.push(consumer);

            // Add track to the remote peer's MediaStream
            setRemoteStreams((prev) => {
                const existing = prev[peerId] || new MediaStream();
                existing.addTrack(consumer.track);
                return { ...prev, [peerId]: existing };
            });

            // Resume the consumer (it was created paused)
            await emitAsync("resume-consumer", { consumerId: consumer.id });

            console.log(`[Room] ✅ Consuming ${kind} from ${peerId}`);
        } catch (err) {
            console.error(`[Room] Failed to consume ${kind} from ${peerId}:`, err);
        }
    }, []);

    // ── Main initialization effect ───────────────────────────────────────────
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        console.log("[Room] Initializing room:", roomId);

        async function init() {
            try {
                // Step 1: Join the room and get RTP capabilities
                setStatus("Joining room…");
                const { rtpCapabilities } = await emitAsync("join-room", roomId);
                console.log("[Room] Joined room, got RTP capabilities");

                // Step 2: Load the mediasoup Device
                setStatus("Loading device…");
                const device = new mediasoupClient.Device();
                await device.load({ routerRtpCapabilities: rtpCapabilities });
                deviceRef.current = device;
                console.log("[Room] Device loaded");

                // Step 3: Create send transport
                setStatus("Setting up connection…");
                const sendTransportParams = await emitAsync("create-send-transport");
                const sendTransport = device.createSendTransport(sendTransportParams);
                sendTransportRef.current = sendTransport;

                sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                    emitAsync("connect-transport", {
                        transportId: sendTransport.id,
                        dtlsParameters,
                    })
                        .then(() => callback())
                        .catch(errback);
                });

                sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
                    emitAsync("produce", {
                        transportId: sendTransport.id,
                        kind,
                        rtpParameters,
                    })
                        .then(({ id }) => callback({ id }))
                        .catch(errback);
                });

                sendTransport.on("connectionstatechange", (state) => {
                    console.log("[SendTransport] State:", state);
                    if (state === "connected") setStatus("🟢 Live");
                    if (state === "failed") setStatus("❌ Connection failed");
                });

                // Step 4: Create recv transport
                const recvTransportParams = await emitAsync("create-recv-transport");
                const recvTransport = device.createRecvTransport(recvTransportParams);
                recvTransportRef.current = recvTransport;

                recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                    emitAsync("connect-transport", {
                        transportId: recvTransport.id,
                        dtlsParameters,
                    })
                        .then(() => callback())
                        .catch(errback);
                });

                recvTransport.on("connectionstatechange", (state) => {
                    console.log("[RecvTransport] State:", state);
                });

                // Step 5: Capture local media and produce audio + video
                setStatus("Requesting camera & mic…");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 },
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

                streamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // Produce VIDEO
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const videoProducer = await sendTransport.produce({ track: videoTrack });
                    producersRef.current.push(videoProducer);
                    videoProducer.on("trackended", () => console.warn("[Producer] Video track ended"));
                    videoProducer.on("transportclose", () => console.warn("[Producer] Send transport closed"));
                    console.log("[Room] Video producer created:", videoProducer.id);
                }

                // Produce AUDIO
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                    const audioProducer = await sendTransport.produce({ track: audioTrack });
                    producersRef.current.push(audioProducer);
                    audioProducer.on("trackended", () => console.warn("[Producer] Audio track ended"));
                    audioProducer.on("transportclose", () => console.warn("[Producer] Send transport closed"));
                    console.log("[Room] Audio producer created:", audioProducer.id);
                }

                setStatus("🟢 Live");

                // Step 6: Consume existing producers in the room
                const { producers } = await emitAsync("get-producers");
                setPeerCount(new Set(producers.map((p) => p.peerId)).size);

                for (const { producerId, peerId, kind } of producers) {
                    await consumeProducer(producerId, peerId, kind);
                }

                // Step 7: Fetch chat history
                const { messages } = await emitAsync("get-chat-history");
                if (messages?.length) setChatMessages(messages);

                console.log("[Room] ✅ Fully initialized");
            } catch (err) {
                if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    setStatus("❌ Camera/mic permission denied");
                } else {
                    console.error("[Room] Init error:", err);
                    setStatus("❌ " + err.message);
                }
            }
        }

        // ── Listen for new producers from other peers ────────────────────────
        socket.on("new-producer", async ({ producerId, peerId, kind }) => {
            console.log(`[Room] New producer from peer ${peerId}: ${kind}`);
            setPeerCount((prev) => prev + (kind === "video" ? 1 : 0)); // count by video
            await consumeProducer(producerId, peerId, kind);
        });

        // ── Listen for peers joining (they haven't produced yet) ─────────────
        socket.on("new-peer", ({ peerId }) => {
            console.log(`[Room] New peer joined: ${peerId}`);
        });

        // ── Listen for peers leaving ─────────────────────────────────────────
        socket.on("peer-left", ({ peerId }) => {
            console.log(`[Room] Peer left: ${peerId}`);
            setRemoteStreams((prev) => {
                const updated = { ...prev };
                delete updated[peerId];
                return updated;
            });
            setPeerCount((prev) => Math.max(0, prev - 1));
        });

        // ── Listen for producer being closed ─────────────────────────────────
        socket.on("producer-closed", ({ producerId }) => {
            console.log(`[Room] Producer closed: ${producerId}`);
            consumersRef.current = consumersRef.current.filter(
                (c) => c.producerId !== producerId
            );
        });

        // ── Listen for chat messages ─────────────────────────────────────────
        socket.on("new-message", (msg) => {
            setChatMessages((prev) => [...prev, msg]);
            // Increment unread if chat panel is closed
            setChatOpen((open) => {
                if (!open) setUnreadCount((c) => c + 1);
                return open;
            });
        });

        // ── Listen for peers list updates ────────────────────────────────────
        socket.on("peers-list", ({ peers }) => {
            setPeersList(peers);
            setPeerCount(peers.length);
        });

        // ── Listen for raise hand ─────────────────────────────────────────
        socket.on("hand-raised", ({ peerId, raised }) => {
            setRaisedHands((prev) => {
                const updated = { ...prev };
                if (raised) updated[peerId] = true;
                else delete updated[peerId];
                return updated;
            });
        });

        init();

        // ── Cleanup on unmount ───────────────────────────────────────────────
        return () => {
            socket.off("new-producer");
            socket.off("new-peer");
            socket.off("peer-left");
            socket.off("producer-closed");
            socket.off("new-message");
            socket.off("peers-list");
            socket.off("hand-raised");

            streamRef.current?.getTracks().forEach((t) => t.stop());
            producersRef.current.forEach((p) => p.close());
            consumersRef.current.forEach((c) => c.close());
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();

            console.log("[Room] Cleaned up");
        };
    }, [roomId, consumeProducer]);

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

    function handleLeave() {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        producersRef.current.forEach((p) => p.close());
        consumersRef.current.forEach((c) => c.close());
        screenProducerRef.current?.close();
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
        navigate("/");
    }

    // ── Screen sharing ───────────────────────────────────────────────────────
    async function toggleScreenShare() {
        if (isScreenSharing) {
            // Stop screen share
            screenProducerRef.current?.close();
            screenProducerRef.current = null;
            setIsScreenSharing(false);
            return;
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false,
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            const sendTransport = sendTransportRef.current;
            if (!sendTransport || !screenTrack) return;

            const screenProducer = await sendTransport.produce({
                track: screenTrack,
                appData: { type: "screen" },
            });

            screenProducerRef.current = screenProducer;
            setIsScreenSharing(true);

            // Auto-stop when user clicks browser's native "Stop sharing" button
            screenTrack.onended = () => {
                screenProducer.close();
                screenProducerRef.current = null;
                setIsScreenSharing(false);
            };
        } catch (err) {
            // User cancelled the screen picker — not an error
            if (err.name !== "NotAllowedError") {
                console.error("[Room] Screen share error:", err);
            }
        }
    }

    // ── Raise hand ────────────────────────────────────────────────────────────
    const myHandRaised = raisedHands[socket.id] || false;

    function toggleRaiseHand() {
        const newState = !myHandRaised;
        socket.emit("raise-hand", { raised: newState });
        // Auto-lower after 30 seconds
        if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);
        if (newState) {
            raiseTimerRef.current = setTimeout(() => {
                socket.emit("raise-hand", { raised: false });
            }, 30000);
        }
    }

    // ── Chat helpers ──────────────────────────────────────────────────────────
    function handleSendMessage() {
        const text = chatInput.trim();
        if (!text) return;
        emitAsync("send-message", { message: text }).catch(console.error);
        setChatInput("");
    }

    function handleChatKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    function toggleChat() {
        setChatOpen((prev) => {
            if (!prev) setUnreadCount(0); // clear unread when opening
            return !prev;
        });
    }

    // Auto-scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // ── Compute grid layout class based on participant count ─────────────────
    const totalParticipants = 1 + Object.keys(remoteStreams).length;
    const gridClass =
        totalParticipants <= 1
            ? "grid-1"
            : totalParticipants <= 2
            ? "grid-2"
            : totalParticipants <= 4
            ? "grid-4"
            : "grid-many";

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="room-container">
            {/* Header */}
            <header className="room-header">
                <span className="room-logo">Verve</span>
                <div className="room-id-badge">
                    <span className="room-id-label">Room</span>
                    <span className="room-id-value">{roomId}</span>
                    <button
                        className="copy-btn"
                        onClick={() => {
                            navigator.clipboard.writeText(roomId);
                        }}
                        title="Copy Room ID"
                    >
                        📋
                    </button>
                </div>
                <div className="peer-count">
                    👥 {totalParticipants}
                </div>
                <div
                    className={`status-pill ${
                        status.startsWith("🟢")
                            ? "live"
                            : status.startsWith("❌")
                            ? "error"
                            : "pending"
                    }`}
                >
                    {status}
                </div>
            </header>

            {/* Video stage */}
            <main className={`video-stage ${gridClass}`}>
                {/* Local video */}
                <div className="video-card local">
                    <video
                        ref={localVideoRef}
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
                    <div className="video-label">You</div>
                    {raisedHands[socket.id] && <div className="hand-badge">✋</div>}
                </div>

                {/* Remote videos */}
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                    <RemoteVideo
                        key={peerId}
                        peerId={peerId}
                        stream={stream}
                        handRaised={!!raisedHands[peerId]}
                    />
                ))}
            </main>

            {/* Chat Panel */}
            <div className={`chat-panel ${chatOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>Chat</span>
                    <button className="chat-close" onClick={toggleChat}>✕</button>
                </div>
                <div className="chat-messages">
                    {chatMessages.length === 0 && (
                        <p className="chat-empty">No messages yet. Say hi! 👋</p>
                    )}
                    {chatMessages.map((msg, i) => (
                        <div
                            key={i}
                            className={`chat-bubble ${msg.peerId === socket.id ? "self" : ""}`}
                        >
                            <span className="chat-sender">
                                {msg.peerId === socket.id ? "You" : `Peer ${msg.peerId.slice(0, 6)}`}
                            </span>
                            <p className="chat-text">{msg.message}</p>
                            <span className="chat-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
                <div className="chat-input-group">
                    <input
                        type="text"
                        placeholder="Type a message…"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleChatKeyDown}
                        id="chat-input"
                    />
                    <button
                        className="chat-send-btn"
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim()}
                    >
                        ➤
                    </button>
                </div>
            </div>

            {/* Participants Panel */}
            <div className={`participants-panel ${participantsOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>Participants ({peersList.length})</span>
                    <button className="chat-close" onClick={() => setParticipantsOpen(false)}>✕</button>
                </div>
                <div className="participants-list">
                    {peersList.map((pid) => (
                        <div key={pid} className="participant-item">
                            <div className="participant-avatar">
                                {pid === socket.id ? "Y" : pid.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="participant-name">
                                {pid === socket.id ? "You" : `Peer ${pid.slice(0, 6)}`}
                            </span>
                            {pid === socket.id && <span className="participant-you-tag">You</span>}
                        </div>
                    ))}
                </div>
            </div>

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

                <button
                    className={`ctrl-btn ${chatOpen ? "active" : ""}`}
                    onClick={toggleChat}
                    title="Toggle chat"
                    id="btn-toggle-chat"
                >
                    💬
                    <span>Chat</span>
                    {unreadCount > 0 && (
                        <span className="unread-badge">{unreadCount}</span>
                    )}
                </button>

                <button
                    className={`ctrl-btn ${isScreenSharing ? "active" : ""}`}
                    onClick={toggleScreenShare}
                    title={isScreenSharing ? "Stop sharing" : "Share screen"}
                    id="btn-toggle-screen"
                >
                    {isScreenSharing ? "🗕" : "💻"}
                    <span>{isScreenSharing ? "Stop" : "Share"}</span>
                </button>

                <button
                    className={`ctrl-btn ${participantsOpen ? "active" : ""}`}
                    onClick={() => setParticipantsOpen((prev) => !prev)}
                    title="Toggle participants"
                    id="btn-toggle-participants"
                >
                    👥
                    <span>People</span>
                </button>

                <button
                    className={`ctrl-btn ${myHandRaised ? "active" : ""}`}
                    onClick={toggleRaiseHand}
                    title={myHandRaised ? "Lower hand" : "Raise hand"}
                    id="btn-raise-hand"
                >
                    ✋
                    <span>{myHandRaised ? "Lower" : "Raise"}</span>
                </button>

                <button
                    className="ctrl-btn leave"
                    onClick={handleLeave}
                    title="Leave meeting"
                    id="btn-leave"
                >
                    📞
                    <span>Leave</span>
                </button>
            </footer>
        </div>
    );
}

// ── Remote video component ───────────────────────────────────────────────────
function RemoteVideo({ peerId, stream, handRaised }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="video-card remote">
            <video ref={videoRef} autoPlay playsInline />
            <div className="video-label">
                Peer {peerId.slice(0, 6)}
            </div>
            {handRaised && <div className="hand-badge">✋</div>}
        </div>
    );
}

export default Room;
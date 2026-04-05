//  Room.jsx — Video call screen
//  All WebRTC / Mediasoup / Socket.IO logic is PRESERVED EXACTLY.
//  Each tab creates its own isolated socket — tabs no longer share one connection.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createSocket } from "../socket";
import * as mediasoupClient from "mediasoup-client";
import "./Room.css";

// ── Inline SVG icons (no icon library needed) ──────────────
const IconMic = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
);

const IconMicOff = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
        <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
);

const IconVideo = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
);

const IconVideoOff = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/>
        <path d="M23 7l-7 5 7 5V7z"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

const IconChat = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
);

const IconScreen = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
);

const IconUsers = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
);

const IconHand = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
);

const IconPhone = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.14-1.14a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
);

const IconCopy = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
);

const IconSend = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
);

// ── Avatar color from peer ID ──────────────────────────────
function peerColor(peerId) {
    const colors = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444"];
    let hash = 0;
    for (const c of peerId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
}

// ── RemoteVideo ────────────────────────────────────────────
function RemoteVideo({ peerId, stream, handRaised }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

    return (
        <div className="video-card remote">
            <video ref={videoRef} autoPlay playsInline />
            {!hasVideo && (
                <div className="cam-off-overlay">
                    <div className="cam-off-avatar" style={{ background: peerColor(peerId) }}>
                        {peerId.slice(0, 1).toUpperCase()}
                    </div>
                    <p>Peer {peerId.slice(0, 6)}</p>
                </div>
            )}
            <div className="video-label">Peer {peerId.slice(0, 6)}</div>
            {handRaised && <div className="hand-badge">✋</div>}
        </div>
    );
}

// ── Room ───────────────────────────────────────────────────
function Room() {
    const { roomId } = useParams();
    const navigate   = useNavigate();

    // Refs — Mediasoup objects + socket don't need to trigger re-renders
    const socketRef         = useRef(null);
    const localVideoRef    = useRef(null);
    const deviceRef        = useRef(null);
    const sendTransportRef = useRef(null);
    const recvTransportRef = useRef(null);
    const streamRef        = useRef(null);
    const producersRef     = useRef([]);
    const consumersRef     = useRef([]);
    const producerToPeerRef = useRef({}); // Mapping: producerId -> { peerId, type }
    const initializedRef   = useRef(false);

    // UI state
    const [status,        setStatus]        = useState("Connecting…");
    const [isMuted,       setIsMuted]       = useState(false);
    const [isCamOff,      setIsCamOff]      = useState(false);
    const [remoteStreams,  setRemoteStreams]  = useState({});
    const [peerCount,     setPeerCount]     = useState(0);

    // Chat
    const [chatOpen,     setChatOpen]     = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput,    setChatInput]    = useState("");
    const [unreadCount,  setUnreadCount]  = useState(0);
    const chatEndRef = useRef(null);

    // Participants
    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [peersList,        setPeersList]         = useState([]);

    // Screen share
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [localScreenStream, setLocalScreenStream] = useState(null);
    const screenProducerRef = useRef(null);

    // Raise hand
    const [raisedHands, setRaisedHands] = useState({});
    const raiseTimerRef = useRef(null);

    // Toast
    const [toast, setToast] = useState(null);

    // Creator flag
    const [isCreator, setIsCreator] = useState(false);

    // Ended overlay (shown briefly before redirect)
    const [roomEnded, setRoomEnded] = useState(false);

    // ── Helpers ─────────────────────────────────────────────
    function emitAsync(event, data = {}) {
        return new Promise((resolve, reject) => {
            socketRef.current.emit(event, data, (response) => {
                if (response?.error) reject(new Error(response.error));
                else resolve(response);
            });
        });
    }

    function showToast(msg) {
        setToast({ msg, hide: false });
        setTimeout(() => setToast((t) => t ? { ...t, hide: true } : null), 2200);
        setTimeout(() => setToast(null), 2500);
    }

    function copyRoomLink() {
        const url = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(url).then(() => showToast("Room link copied!"));
    }

    // ── Consume a remote producer ────────────────────────────
    const consumeProducer = useCallback(async (producerId, peerId, kind, appData) => {
        try {
            const device = deviceRef.current;
            if (!device) return;

            const consumerData = await emitAsync("consume", {
                producerId,
                rtpCapabilities: device.rtpCapabilities,
            });

            const recvTransport = recvTransportRef.current;
            if (!recvTransport) return;

            const consumer = await recvTransport.consume({
                id:            consumerData.id,
                producerId:    consumerData.producerId,
                kind:          consumerData.kind,
                rtpParameters: consumerData.rtpParameters,
            });

            // Listen to track ending to re-render UI if someone stops video/screen
            consumer.track.onended = () => {
                 setRemoteStreams((prev) => ({ ...prev }));
            };

            consumersRef.current.push(consumer);

            // Save mapping for cleanup later
            producerToPeerRef.current[producerId] = { peerId, type: (appData?.type === "screen" ? "screen" : "webcam") };

            setRemoteStreams((prev) => {
                const existing = prev[peerId] || { webcam: new MediaStream(), screen: new MediaStream() };
                if (appData && appData.type === "screen") {
                    existing.screen.addTrack(consumer.track);
                } else {
                    existing.webcam.addTrack(consumer.track);
                }
                return { ...prev, [peerId]: existing };
            });

            await emitAsync("resume-consumer", { consumerId: consumer.id });
        } catch (err) {
            console.error(`[Room] Failed to consume ${kind} from ${peerId}:`, err);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Main init effect ────────────────────────────────────
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        // Create a fresh socket for THIS tab and connect it
        const sock = createSocket();
        socketRef.current = sock;
        sock.connect();

        async function init() {
            try {
                setStatus("Joining room…");
                const { rtpCapabilities, isCreator: creator } = await emitAsync("join-room", roomId);
                if (creator) setIsCreator(true);

                setStatus("Loading device…");
                const device = new mediasoupClient.Device();
                await device.load({ routerRtpCapabilities: rtpCapabilities });
                deviceRef.current = device;

                setStatus("Setting up connection…");
                const sendTransportParams = await emitAsync("create-send-transport");
                const sendTransport = device.createSendTransport(sendTransportParams);
                sendTransportRef.current = sendTransport;

                sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                    emitAsync("connect-transport", { transportId: sendTransport.id, dtlsParameters })
                        .then(() => callback()).catch(errback);
                });

                sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
                    emitAsync("produce", { transportId: sendTransport.id, kind, rtpParameters, appData })
                        .then(({ id }) => callback({ id })).catch(errback);
                });

                sendTransport.on("connectionstatechange", (state) => {
                    if (state === "connected") setStatus("live");
                    if (state === "failed")    setStatus("error");
                });

                const recvTransportParams = await emitAsync("create-recv-transport");
                const recvTransport = device.createRecvTransport(recvTransportParams);
                recvTransportRef.current = recvTransport;

                recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                    emitAsync("connect-transport", { transportId: recvTransport.id, dtlsParameters })
                        .then(() => callback()).catch(errback);
                });

                setStatus("Requesting camera & mic…");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                });

                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const vp = await sendTransport.produce({ track: videoTrack });
                    producersRef.current.push(vp);
                }

                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                    const ap = await sendTransport.produce({ track: audioTrack });
                    producersRef.current.push(ap);
                }

                setStatus("live");

                const { producers } = await emitAsync("get-producers");
                setPeerCount(new Set(producers.map((p) => p.peerId)).size);
                for (const { producerId, peerId, kind, appData } of producers) {
                    await consumeProducer(producerId, peerId, kind, appData);
                }

                const { messages } = await emitAsync("get-chat-history");
                if (messages?.length) setChatMessages(messages);

            } catch (err) {
                if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    setStatus("Camera/mic permission denied");
                } else {
                    setStatus("error");
                    console.error("[Room] Init error:", err);
                }
            }
        }

        // ── Socket listeners ─────────────────────────────────
        sock.on("new-producer", async ({ producerId, peerId, kind, appData }) => {
            setPeerCount((prev) => prev + (kind === "video" && (!appData || appData.type !== "screen") ? 1 : 0));
            await consumeProducer(producerId, peerId, kind, appData);
        });

        sock.on("new-peer", ({ peerId }) => {
            console.log("[Room] New peer:", peerId);
        });

        sock.on("peer-left", ({ peerId }) => {
            setRemoteStreams((prev) => {
                const updated = { ...prev };
                delete updated[peerId];
                return updated;
            });
            setPeerCount((prev) => Math.max(0, prev - 1));
        });

        sock.on("producer-closed", ({ producerId }) => {
            console.log(`[Room] Producer closed: ${producerId}`);
            
            const mapping = producerToPeerRef.current[producerId];
            const consumer = consumersRef.current.find((c) => c.producerId === producerId);

            if (consumer) {
                consumer.track.stop();
                consumer.close();
            }

            if (mapping) {
                const { peerId, type } = mapping;
                setRemoteStreams((prev) => {
                    const streams = prev[peerId];
                    if (streams && streams[type]) {
                        // Remove the specific track from the MediaStream objects
                        if (consumer) streams[type].removeTrack(consumer.track);
                    }
                    return { ...prev }; // Trigger re-render
                });
                delete producerToPeerRef.current[producerId];
            }

            consumersRef.current = consumersRef.current.filter((c) => c.producerId !== producerId);
        });

        sock.on("new-message", (msg) => {
            setChatMessages((prev) => [...prev, msg]);
            setChatOpen((open) => {
                if (!open) setUnreadCount((c) => c + 1);
                return open;
            });
        });

        sock.on("peers-list", ({ peers }) => {
            setPeersList(peers);
            setPeerCount(peers.length);
        });

        sock.on("hand-raised", ({ peerId, raised }) => {
            setRaisedHands((prev) => {
                const updated = { ...prev };
                if (raised) updated[peerId] = true;
                else delete updated[peerId];
                return updated;
            });
        });

        // ── Room closed by creator ──
        // Fires for ALL participants (including the creator themselves via io.to)
        sock.on("room-closed", ({ reason }) => {
            setRoomEnded(true);
            setToast({ msg: reason || "Meeting ended by host", hide: false });
            // Clean up local media immediately
            streamRef.current?.getTracks().forEach((t) => t.stop());
            producersRef.current.forEach((p) => p.close());
            consumersRef.current.forEach((c) => c.close());
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();
            setTimeout(() => navigate("/"), 2500);
        });

        // Wait for socket to connect before running the WebRTC init
        if (sock.connected) {
            init();
        } else {
            sock.once("connect", () => init());
        }

        return () => {
            // Tear down all media
            streamRef.current?.getTracks().forEach((t) => t.stop());
            producersRef.current.forEach((p) => p.close());
            consumersRef.current.forEach((c) => c.close());
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();

            // Disconnect THIS tab's socket — server fires disconnect only for this socket.id
            sock.disconnect();
        };
    }, [roomId, consumeProducer]);

    // ── Controls ─────────────────────────────────────────────
    function toggleMute() {
        streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
        setIsMuted((prev) => !prev);
    }

    function toggleCamera() {
        streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
        setIsCamOff((prev) => !prev);
    }

    function handleLeave() {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        producersRef.current.forEach((p) => p.close());
        consumersRef.current.forEach((c) => c.close());
        screenProducerRef.current?.close();
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
        socketRef.current?.disconnect();
        navigate("/");
    }

    function handleEndMeeting() {
        // Emit end-room — server will broadcast room-closed to everyone
        socketRef.current.emit("end-room");
        // Clean up creator's own resources; the room-closed listener will navigate
        streamRef.current?.getTracks().forEach((t) => t.stop());
        producersRef.current.forEach((p) => p.close());
        consumersRef.current.forEach((c) => c.close());
        screenProducerRef.current?.close();
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
        navigate("/");
    }

    async function toggleScreenShare() {
        if (isScreenSharing) {
            screenProducerRef.current?.close();
            screenProducerRef.current = null;
            setIsScreenSharing(false);
            setLocalScreenStream(null);
            return;
        }
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
            const screenTrack  = screenStream.getVideoTracks()[0];
            const sendTransport = sendTransportRef.current;
            if (!sendTransport || !screenTrack) return;

            const screenProducer = await sendTransport.produce({ track: screenTrack, appData: { type: "screen" } });
            screenProducerRef.current = screenProducer;
            setLocalScreenStream(screenStream);
            setIsScreenSharing(true);

            screenTrack.onended = () => {
                screenProducer.close();
                screenProducerRef.current = null;
                setLocalScreenStream(null);
                setIsScreenSharing(false);
            };
        } catch (err) {
            if (err.name !== "NotAllowedError") console.error("[Room] Screen share error:", err);
        }
    }

    const myHandRaised = raisedHands[socketRef.current?.id] || false;

    function toggleRaiseHand() {
        const newState = !myHandRaised;
        socketRef.current?.emit("raise-hand", { raised: newState });
        if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);
        if (newState) {
            raiseTimerRef.current = setTimeout(() => socketRef.current?.emit("raise-hand", { raised: false }), 30000);
        }
    }

    function handleSendMessage() {
        const text = chatInput.trim();
        if (!text) return;
        emitAsync("send-message", { message: text }).catch(console.error);
        setChatInput("");
    }

    function handleChatKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    }

    function toggleChat() {
        setChatOpen((prev) => {
            if (!prev) setUnreadCount(0);
            return !prev;
        });
    }

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // Grid class
    const totalParticipants = 1 + Object.keys(remoteStreams).length + (localScreenStream ? 1 : 0) + Object.values(remoteStreams).filter(s => s.screen?.getVideoTracks().some(t => t.readyState === "live")).length;
    const gridClass =
        totalParticipants <= 1 ? "grid-1"
        : totalParticipants <= 2 ? "grid-2"
        : totalParticipants <= 4 ? "grid-4"
        : "grid-many";

    // Status pill class
    const statusClass = status === "live" ? "live" : status === "error" ? "error" : "pending";
    const statusLabel = status === "live" ? "Live" : status === "error" ? "Connection failed" : status;

    return (
        <div className="room-container">
            {/* ── Header ── */}
            <header className="room-header">
                <span className="room-logo">Verve</span>

                <div className="room-id-badge" title="Click copy button to share this room">
                    <span className="room-id-label">Room</span>
                    <span className="room-id-value">{roomId}</span>
                    <button className="copy-btn" onClick={copyRoomLink} title="Copy invite link">
                        <IconCopy />
                    </button>
                </div>

                <div className="peer-count">
                    <IconUsers />
                    {totalParticipants}
                </div>

                <div className={`status-pill ${statusClass}`}>
                    <span className="status-dot" />
                    {statusLabel}
                </div>
            </header>

            {/* ── Video stage ── */}
            <main className={`video-stage ${gridClass}`}>
                {/* Local tile */}
                <div className="video-card local">
                    <video
                        ref={localVideoRef}
                        autoPlay playsInline muted
                        className={isCamOff ? "cam-off" : ""}
                    />
                    {isCamOff && (
                        <div className="cam-off-overlay">
                            <div className="cam-off-avatar">Y</div>
                            <p>Camera Off</p>
                        </div>
                    )}
                    {isScreenSharing && <div className="screen-share-badge">Sharing screen</div>}
                    <div className="video-label">You</div>
                    {raisedHands[socketRef.current?.id] && <div className="hand-badge">✋</div>}
                </div>

                {/* Local Screen Share Tile */}
                {localScreenStream && (
                    <div className="video-card local screen-share">
                        <video
                            ref={(el) => { if (el) el.srcObject = localScreenStream; }}
                            autoPlay playsInline muted
                        />
                        <div className="video-label">Your Screen</div>
                    </div>
                )}

                {/* Remote tiles */}
                {Object.entries(remoteStreams).map(([peerId, streams]) => (
                    <React.Fragment key={peerId}>
                        <RemoteVideo
                            peerId={peerId}
                            stream={streams.webcam}
                            handRaised={!!raisedHands[peerId]}
                        />
                        {streams.screen && streams.screen.getVideoTracks().some(t => t.readyState === "live") && (
                            <RemoteVideo
                                peerId={`${peerId}-screen`}
                                stream={streams.screen}
                                handRaised={false}
                            />
                        )}
                    </React.Fragment>
                ))}
            </main>

            {/* ── Chat panel ── */}
            <div className={`chat-panel ${chatOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>Chat</span>
                    <button className="chat-close" onClick={toggleChat}>✕</button>
                </div>
                <div className="chat-messages">
                    {chatMessages.length === 0 && (
                        <p className="chat-empty">No messages yet.<br />Say hi! 👋</p>
                    )}
                    {chatMessages.map((msg, i) => (
                        <div key={i} className={`chat-bubble ${msg.peerId === socketRef.current?.id ? "self" : ""}`}>
                            <span className="chat-sender">
                                {msg.peerId === socketRef.current?.id ? "You" : `Peer ${msg.peerId.slice(0, 6)}`}
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
                    <button className="chat-send-btn" onClick={handleSendMessage} disabled={!chatInput.trim()}>
                        <IconSend />
                    </button>
                </div>
            </div>

            {/* ── Participants panel ── */}
            <div className={`participants-panel ${participantsOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>People ({peersList.length})</span>
                    <button className="chat-close" onClick={() => setParticipantsOpen(false)}>✕</button>
                </div>
                <div className="participants-list">
                    {peersList.map((pid) => (
                        <div key={pid} className="participant-item">
                            <div className="participant-avatar" style={{ background: peerColor(pid) }}>
                                {pid === socketRef.current?.id ? "Y" : pid.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="participant-name">
                                {pid === socketRef.current?.id ? "You" : `Peer ${pid.slice(0, 6)}`}
                            </span>
                            {pid === socketRef.current?.id && <span className="participant-you-tag">You</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Controls ── */}
            <footer className="room-controls">
                <button
                    className={`ctrl-btn ${isMuted ? "muted" : ""}`}
                    onClick={toggleMute}
                    title={isMuted ? "Unmute" : "Mute"}
                    id="btn-toggle-mute"
                >
                    {isMuted ? <IconMicOff /> : <IconMic />}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                </button>

                <button
                    className={`ctrl-btn ${isCamOff ? "active" : ""}`}
                    onClick={toggleCamera}
                    title={isCamOff ? "Turn camera on" : "Turn camera off"}
                    id="btn-toggle-camera"
                >
                    {isCamOff ? <IconVideoOff /> : <IconVideo />}
                    <span>{isCamOff ? "Cam On" : "Cam Off"}</span>
                </button>

                <button
                    className={`ctrl-btn ${isScreenSharing ? "active" : ""}`}
                    onClick={toggleScreenShare}
                    title={isScreenSharing ? "Stop sharing" : "Share screen"}
                    id="btn-toggle-screen"
                >
                    <IconScreen />
                    <span>{isScreenSharing ? "Stop" : "Share"}</span>
                </button>

                <div className="controls-divider" />

                <button
                    className={`ctrl-btn ${chatOpen ? "active" : ""}`}
                    onClick={toggleChat}
                    title="Toggle chat"
                    id="btn-toggle-chat"
                >
                    <IconChat />
                    <span>Chat</span>
                    {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
                </button>

                <button
                    className={`ctrl-btn ${participantsOpen ? "active" : ""}`}
                    onClick={() => setParticipantsOpen((prev) => !prev)}
                    title="Participants"
                    id="btn-toggle-participants"
                >
                    <IconUsers />
                    <span>People</span>
                </button>

                <button
                    className={`ctrl-btn ${myHandRaised ? "active" : ""}`}
                    onClick={toggleRaiseHand}
                    title={myHandRaised ? "Lower hand" : "Raise hand"}
                    id="btn-raise-hand"
                >
                    <IconHand />
                    <span>{myHandRaised ? "Lower" : "Raise"}</span>
                </button>

                <div className="controls-divider" />

                {isCreator ? (
                    <button
                        className="ctrl-btn end-meeting"
                        onClick={handleEndMeeting}
                        title="End meeting for everyone"
                        id="btn-end-meeting"
                    >
                        <IconPhone />
                        <span>End&nbsp;Meeting</span>
                    </button>
                ) : (
                    <button
                        className="ctrl-btn leave"
                        onClick={handleLeave}
                        title="Leave meeting"
                        id="btn-leave"
                    >
                        <IconPhone />
                        <span>Leave</span>
                    </button>
                )}
            </footer>

            {/* ── Room-ended overlay ── */}
            {roomEnded && (
                <div className="room-ended-overlay">
                    <div className="room-ended-card">
                        <div className="room-ended-icon">📞</div>
                        <h2>Meeting Ended</h2>
                        <p>The host has ended this meeting.</p>
                        <p className="room-ended-sub">Redirecting you to the home page…</p>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`room-toast ${toast.hide ? "hide" : ""}`}>
                    ✓ {toast.msg}
                </div>
            )}
        </div>
    );
}

export default Room;
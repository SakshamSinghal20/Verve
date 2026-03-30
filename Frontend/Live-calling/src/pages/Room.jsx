//  Room.jsx — The actual video call screen
//
//  What this file does:
//   1. Joins the room via Socket.IO
//   2. Sets up Mediasoup send + recv transports
//   3. Captures the local camera/mic and sends it to the server
//   4. Subscribes to all other participants' streams
//   5. Handles chat, screen share, raise hand, and participants list

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../App";                        // shared socket connection
import * as mediasoupClient from "mediasoup-client";    // browser-side Mediasoup
import "./Room.css";

function Room() {
    const { roomId } = useParams(); // grab the room ID from the URL (e.g. /room/abc123)
    const navigate = useNavigate();

    // ── Refs 
    // Refs hold values that shouldn't trigger re-renders when they change.
    // Mediasoup objects (transports, producers, consumers) live here.
    const localVideoRef = useRef(null);  // <video> element for your own camera
    const deviceRef = useRef(null);  // Mediasoup Device — negotiates codecs with the server
    const sendTransportRef = useRef(null);  // upload pipe: your media → server
    const recvTransportRef = useRef(null);  // download pipe: server → your screen
    const streamRef = useRef(null);  // your raw camera/mic MediaStream
    const producersRef = useRef([]);    // your outgoing media producers (video + audio)
    const consumersRef = useRef([]);    // incoming consumers (one per remote stream)
    const initializedRef = useRef(false); // guard so we don't run setup twice

    // ── UI state 
    // These values drive what the user sees.
    const [status, setStatus] = useState("Connecting…");  // status pill in the header
    const [isMuted, setIsMuted] = useState(false);           // microphone on/off
    const [isCamOff, setIsCamOff] = useState(false);           // camera on/off
    const [remoteStreams, setRemoteStreams] = useState({});              // peerId → MediaStream
    const [peerCount, setPeerCount] = useState(0);               // total number of people in room

    // ── Chat state 
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [unreadCount, setUnreadCount] = useState(0); // badge on chat button when panel is closed
    const chatEndRef = useRef(null); // used to auto-scroll to newest message

    // ── Participants panel state 
    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [peersList, setPeersList] = useState([]); // list of socket IDs in the room

    // ── Screen sharing state 
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const screenProducerRef = useRef(null); // the screen share Mediasoup producer

    // ── Raise hand state 
    const [raisedHands, setRaisedHands] = useState({}); // peerId → true/false
    const raiseTimerRef = useRef(null);  // auto-lower timer handle

    // ── Utility: promisified socket.emit 
    // Socket.IO callbacks don't work well with async/await out of the box.
    // This wrapper converts the callback pattern into a Promise so we can use await.
    function emitAsync(event, data = {}) {
        return new Promise((resolve, reject) => {
            socket.emit(event, data, (response) => {
                if (response?.error) reject(new Error(response.error));
                else resolve(response);
            });
        });
    }

    // ── Subscribe to a remote peer's media stream 
    // "Consuming" = telling the server "give me that person's video/audio".
    // We get back a consumer object whose .track we attach to a <video> element.
    const consumeProducer = useCallback(async (producerId, peerId, kind) => {
        try {
            const device = deviceRef.current;
            if (!device) return; // can't consume without a loaded device

            console.log(`[Room] Consuming ${kind} from peer ${peerId}`);

            // Ask the server to create a consumer for this producer
            const consumerData = await emitAsync("consume", {
                producerId,
                rtpCapabilities: device.rtpCapabilities, // what this browser can decode
            });

            const recvTransport = recvTransportRef.current;
            if (!recvTransport) {
                console.error("[Room] No recv transport available");
                return;
            }

            // Create the browser-side consumer on our recv transport
            const consumer = await recvTransport.consume({
                id: consumerData.id,
                producerId: consumerData.producerId,
                kind: consumerData.kind,
                rtpParameters: consumerData.rtpParameters,
            });

            consumersRef.current.push(consumer);

            // Add this track to the remote peer's MediaStream.
            // We build one MediaStream per peer so each <video> element has its own stream.
            setRemoteStreams((prev) => {
                const existing = prev[peerId] || new MediaStream();
                existing.addTrack(consumer.track);
                return { ...prev, [peerId]: existing };
            });

            // The consumer was created paused — tell the server to start sending data
            await emitAsync("resume-consumer", { consumerId: consumer.id });

            console.log(`[Room] ✅ Consuming ${kind} from ${peerId}`);
        } catch (err) {
            console.error(`[Room] Failed to consume ${kind} from ${peerId}:`, err);
        }
    }, []);

    // ── Main setup effect — runs once when the component mounts
    useEffect(() => {
        // Guard: don't initialize twice (React StrictMode can call effects twice in dev)
        if (initializedRef.current) return;
        initializedRef.current = true;

        console.log("[Room] Initializing room:", roomId);

        async function init() {
            try {
                // ── Step 1: Join the room 
                // The server creates the room if needed and gives us its RTP capabilities.
                setStatus("Joining room…");
                const { rtpCapabilities } = await emitAsync("join-room", roomId);
                console.log("[Room] Joined room, got RTP capabilities");

                // ── Step 2: Load the Mediasoup Device 
                // The Device is the browser-side Mediasoup object that knows which
                // codecs to use based on what the server router supports.
                setStatus("Loading device…");
                const device = new mediasoupClient.Device();
                await device.load({ routerRtpCapabilities: rtpCapabilities });
                deviceRef.current = device;
                console.log("[Room] Device loaded");

                // ── Step 3: Create the send transport 
                // This is the WebRTC connection we'll use to upload our camera/mic.
                setStatus("Setting up connection…");
                const sendTransportParams = await emitAsync("create-send-transport");
                const sendTransport = device.createSendTransport(sendTransportParams);
                sendTransportRef.current = sendTransport;

                // When Mediasoup is ready to connect on the browser side,
                // forward the DTLS parameters to the server to complete the handshake.
                sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                    emitAsync("connect-transport", {
                        transportId: sendTransport.id,
                        dtlsParameters,
                    })
                        .then(() => callback())
                        .catch(errback);
                });

                // When we call sendTransport.produce(), Mediasoup fires this event.
                // We send the track info to the server and return the assigned producer ID.
                sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
                    emitAsync("produce", {
                        transportId: sendTransport.id,
                        kind,
                        rtpParameters,
                    })
                        .then(({ id }) => callback({ id }))
                        .catch(errback);
                });

                // Update the status pill in the header based on connection state
                sendTransport.on("connectionstatechange", (state) => {
                    console.log("[SendTransport] State:", state);
                    if (state === "connected") setStatus("🟢 Live");
                    if (state === "failed") setStatus("❌ Connection failed");
                });

                // ── Step 4: Create the recv transport 
                // This is the WebRTC connection we'll use to download other people's media.
                const recvTransportParams = await emitAsync("create-recv-transport");
                const recvTransport = device.createRecvTransport(recvTransportParams);
                recvTransportRef.current = recvTransport;

                // Same DTLS handshake pattern as the send transport
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

                // ── Step 5: Capture camera and mic 
                setStatus("Requesting camera & mic…");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 },
                    },
                    audio: {
                        echoCancellation: true, // cuts out echo from speakers
                        noiseSuppression: true, // reduces background noise
                        autoGainControl: true, // keeps volume consistent
                    },
                });

                streamRef.current = stream;

                // Show our own camera in the local <video> element (muted so no feedback loop)
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // ── Produce VIDEO 
                // Sending the video track to the server so others can receive it
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const videoProducer = await sendTransport.produce({ track: videoTrack });
                    producersRef.current.push(videoProducer);
                    videoProducer.on("trackended", () => console.warn("[Producer] Video track ended"));
                    videoProducer.on("transportclose", () => console.warn("[Producer] Send transport closed"));
                    console.log("[Room] Video producer created:", videoProducer.id);
                }

                // ── Produce AUDIO 
                // Sending the mic track to the server so others can hear us
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                    const audioProducer = await sendTransport.produce({ track: audioTrack });
                    producersRef.current.push(audioProducer);
                    audioProducer.on("trackended", () => console.warn("[Producer] Audio track ended"));
                    audioProducer.on("transportclose", () => console.warn("[Producer] Send transport closed"));
                    console.log("[Room] Audio producer created:", audioProducer.id);
                }

                setStatus("🟢 Live");

                // ── Step 6: Subscribe to streams already in the room 
                // If there were people in the room before we joined, get their streams now.
                const { producers } = await emitAsync("get-producers");
                setPeerCount(new Set(producers.map((p) => p.peerId)).size);

                for (const { producerId, peerId, kind } of producers) {
                    await consumeProducer(producerId, peerId, kind);
                }

                // ── Step 7: Load chat history 
                // Fetch messages that were sent before we joined
                const { messages } = await emitAsync("get-chat-history");
                if (messages?.length) setChatMessages(messages);

                console.log("[Room] ✅ Fully initialized");
            } catch (err) {
                // Show a friendly error instead of crashing
                if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    setStatus("❌ Camera/mic permission denied");
                } else {
                    console.error("[Room] Init error:", err);
                    setStatus("❌ " + err.message);
                }
            }
        }

        // ── Socket event listeners 
        // These are set up before init() runs so we don't miss any events.

        // Another peer just started sending a stream — subscribe to it
        socket.on("new-producer", async ({ producerId, peerId, kind }) => {
            console.log(`[Room] New producer from peer ${peerId}: ${kind}`);
            setPeerCount((prev) => prev + (kind === "video" ? 1 : 0));
            await consumeProducer(producerId, peerId, kind);
        });

        // A new peer joined the room (they haven't produced any media yet)
        socket.on("new-peer", ({ peerId }) => {
            console.log(`[Room] New peer joined: ${peerId}`);
        });

        // A peer left — remove their video tile from the UI
        socket.on("peer-left", ({ peerId }) => {
            console.log(`[Room] Peer left: ${peerId}`);
            setRemoteStreams((prev) => {
                const updated = { ...prev };
                delete updated[peerId]; // remove their video from the grid
                return updated;
            });
            setPeerCount((prev) => Math.max(0, prev - 1));
        });

        // A producer was closed (e.g. the sender turned off their camera)
        socket.on("producer-closed", ({ producerId }) => {
            console.log(`[Room] Producer closed: ${producerId}`);
            // Remove the matching consumer from our local list
            consumersRef.current = consumersRef.current.filter(
                (c) => c.producerId !== producerId
            );
        });

        // A new chat message arrived — append it to the list
        socket.on("new-message", (msg) => {
            setChatMessages((prev) => [...prev, msg]);
            // If the chat panel is closed, increment the unread badge
            setChatOpen((open) => {
                if (!open) setUnreadCount((c) => c + 1);
                return open;
            });
        });

        // Full list of peers updated (someone joined or left)
        socket.on("peers-list", ({ peers }) => {
            setPeersList(peers);
            setPeerCount(peers.length);
        });

        // Someone raised or lowered their hand
        socket.on("hand-raised", ({ peerId, raised }) => {
            setRaisedHands((prev) => {
                const updated = { ...prev };
                if (raised) updated[peerId] = true;
                else delete updated[peerId];
                return updated;
            });
        });

        init();

        // ── Cleanup when component unmounts (user navigates away or closes tab) ──
        return () => {
            // Stop listening for room events
            socket.off("new-producer");
            socket.off("new-peer");
            socket.off("peer-left");
            socket.off("producer-closed");
            socket.off("new-message");
            socket.off("peers-list");
            socket.off("hand-raised");

            // Stop camera/mic tracks so the browser releases the hardware
            streamRef.current?.getTracks().forEach((t) => t.stop());

            // Close all Mediasoup objects to free server-side resources
            producersRef.current.forEach((p) => p.close());
            consumersRef.current.forEach((c) => c.close());
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();

            console.log("[Room] Cleaned up");
        };
    }, [roomId, consumeProducer]);

    // ── Mute / unmute mic
    // We don't destroy the track — we just disable it so it sends silence
    function toggleMute() {
        const stream = streamRef.current;
        if (!stream) return;
        stream.getAudioTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setIsMuted((prev) => !prev);
    }

    // ── Turn camera on / off 
    // Same idea — disable the track instead of stopping it
    function toggleCamera() {
        const stream = streamRef.current;
        if (!stream) return;
        stream.getVideoTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setIsCamOff((prev) => !prev);
    }

    // ── Leave the meeting 
    // Stop everything and go back to the home page
    function handleLeave() {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        producersRef.current.forEach((p) => p.close());
        consumersRef.current.forEach((c) => c.close());
        screenProducerRef.current?.close();
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
        navigate("/");
    }

    // ── Screen sharing 
    async function toggleScreenShare() {
        if (isScreenSharing) {
            // Stop the current screen share
            screenProducerRef.current?.close();
            screenProducerRef.current = null;
            setIsScreenSharing(false);
            return;
        }

        try {
            // Ask the browser to open the screen picker dialog
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" }, // show the cursor in the share
                audio: false,                // don't capture system audio
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            const sendTransport = sendTransportRef.current;
            if (!sendTransport || !screenTrack) return;

            // Produce the screen track the same way as the camera, with a type label
            const screenProducer = await sendTransport.produce({
                track: screenTrack,
                appData: { type: "screen" }, // lets the receiver know it's a screen, not a camera
            });

            screenProducerRef.current = screenProducer;
            setIsScreenSharing(true);

            // If the user clicks the browser's native "Stop sharing" button,
            // clean up on our side automatically
            screenTrack.onended = () => {
                screenProducer.close();
                screenProducerRef.current = null;
                setIsScreenSharing(false);
            };
        } catch (err) {
            // User cancelled the picker — not a real error, just ignore it
            if (err.name !== "NotAllowedError") {
                console.error("[Room] Screen share error:", err);
            }
        }
    }

    // ── Raise hand 
    const myHandRaised = raisedHands[socket.id] || false;

    function toggleRaiseHand() {
        const newState = !myHandRaised;
        socket.emit("raise-hand", { raised: newState });

        // Auto-lower the hand after 30 seconds so it doesn't stay up forever
        if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);
        if (newState) {
            raiseTimerRef.current = setTimeout(() => {
                socket.emit("raise-hand", { raised: false });
            }, 30000);
        }
    }

    // ── Chat helpers 
    function handleSendMessage() {
        const text = chatInput.trim();
        if (!text) return;
        emitAsync("send-message", { message: text }).catch(console.error);
        setChatInput(""); // clear the input field after sending
    }

    // Send on Enter, allow Shift+Enter for a new line
    function handleChatKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    function toggleChat() {
        setChatOpen((prev) => {
            if (!prev) setUnreadCount(0); // clear unread count when opening the panel
            return !prev;
        });
    }

    // Keep the chat scrolled to the newest message whenever messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // ── Grid layout based on number of participants 
    // CSS classes control how many columns the video grid shows
    const totalParticipants = 1 + Object.keys(remoteStreams).length; // yourself + others
    const gridClass =
        totalParticipants <= 1 ? "grid-1"    // just you
            : totalParticipants <= 2 ? "grid-2"    // you + 1 other
                : totalParticipants <= 4 ? "grid-4"    // up to 4
                    : "grid-many";                          // 5+

    // ── Render 
    return (
        <div className="room-container">
            {/* ── Header: logo, room ID, participant count, connection status ── */}
            <header className="room-header">
                <span className="room-logo">Verve</span>
                <div className="room-id-badge">
                    <span className="room-id-label">Room</span>
                    <span className="room-id-value">{roomId}</span>
                    {/* Copy room ID to clipboard so the user can share it */}
                    <button
                        className="copy-btn"
                        onClick={() => { navigator.clipboard.writeText(roomId); }}
                        title="Copy Room ID"
                    >
                        📋
                    </button>
                </div>
                <div className="peer-count">👥 {totalParticipants}</div>
                {/* Status pill changes color: green = live, red = error, grey = pending */}
                <div
                    className={`status-pill ${status.startsWith("🟢") ? "live"
                            : status.startsWith("❌") ? "error"
                                : "pending"
                        }`}
                >
                    {status}
                </div>
            </header>

            {/* ── Video grid: your video + all remote videos ── */}
            <main className={`video-stage ${gridClass}`}>
                {/* Your own camera tile — muted so you don't hear yourself */}
                <div className="video-card local">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={isCamOff ? "cam-off" : ""}
                    />
                    {/* Overlay shown when the camera is turned off */}
                    {isCamOff && (
                        <div className="cam-off-overlay">
                            <span>📷</span>
                            <p>Camera Off</p>
                        </div>
                    )}
                    <div className="video-label">You</div>
                    {/* Show a hand emoji badge if you raised your hand */}
                    {raisedHands[socket.id] && <div className="hand-badge">✋</div>}
                </div>

                {/* One tile per remote participant */}
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                    <RemoteVideo
                        key={peerId}
                        peerId={peerId}
                        stream={stream}
                        handRaised={!!raisedHands[peerId]}
                    />
                ))}
            </main>

            {/* ── Chat panel: slides in from the right when chatOpen = true ── */}
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
                            {/* "You" for your own messages, shortened peer ID for others */}
                            <span className="chat-sender">
                                {msg.peerId === socket.id ? "You" : `Peer ${msg.peerId.slice(0, 6)}`}
                            </span>
                            <p className="chat-text">{msg.message}</p>
                            <span className="chat-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                    ))}
                    {/* Invisible element at the bottom — we scroll to this on new messages */}
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
                        disabled={!chatInput.trim()} // can't send an empty message
                    >
                        ➤
                    </button>
                </div>
            </div>

            {/* ── Participants panel: list of everyone in the room ── */}
            <div className={`participants-panel ${participantsOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>Participants ({peersList.length})</span>
                    <button className="chat-close" onClick={() => setParticipantsOpen(false)}>✕</button>
                </div>
                <div className="participants-list">
                    {peersList.map((pid) => (
                        <div key={pid} className="participant-item">
                            <div className="participant-avatar">
                                {/* First letter of their peer ID as an avatar */}
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

            {/* ── Control bar at the bottom of the screen ── */}
            <footer className="room-controls">
                {/* Mute / unmute */}
                <button
                    className={`ctrl-btn ${isMuted ? "active" : ""}`}
                    onClick={toggleMute}
                    title={isMuted ? "Unmute" : "Mute"}
                    id="btn-toggle-mute"
                >
                    {isMuted ? "🔇" : "🎙️"}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                </button>

                {/* Camera on / off */}
                <button
                    className={`ctrl-btn ${isCamOff ? "active" : ""}`}
                    onClick={toggleCamera}
                    title={isCamOff ? "Turn camera on" : "Turn camera off"}
                    id="btn-toggle-camera"
                >
                    {isCamOff ? "📷" : "📹"}
                    <span>{isCamOff ? "Cam On" : "Cam Off"}</span>
                </button>

                {/* Chat toggle — shows unread count badge when closed */}
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

                {/* Screen share toggle */}
                <button
                    className={`ctrl-btn ${isScreenSharing ? "active" : ""}`}
                    onClick={toggleScreenShare}
                    title={isScreenSharing ? "Stop sharing" : "Share screen"}
                    id="btn-toggle-screen"
                >
                    {isScreenSharing ? "🗕" : "💻"}
                    <span>{isScreenSharing ? "Stop" : "Share"}</span>
                </button>

                {/* Participants list toggle */}
                <button
                    className={`ctrl-btn ${participantsOpen ? "active" : ""}`}
                    onClick={() => setParticipantsOpen((prev) => !prev)}
                    title="Toggle participants"
                    id="btn-toggle-participants"
                >
                    👥
                    <span>People</span>
                </button>

                {/* Raise / lower hand */}
                <button
                    className={`ctrl-btn ${myHandRaised ? "active" : ""}`}
                    onClick={toggleRaiseHand}
                    title={myHandRaised ? "Lower hand" : "Raise hand"}
                    id="btn-raise-hand"
                >
                    ✋
                    <span>{myHandRaised ? "Lower" : "Raise"}</span>
                </button>

                {/* Leave the meeting */}
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

// ── RemoteVideo component
// A simple component that renders one remote participant's video tile.
// We keep it separate so each tile manages its own <video> ref.
function RemoteVideo({ peerId, stream, handRaised }) {
    const videoRef = useRef(null);

    // Attach the MediaStream to the <video> element whenever it changes
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="video-card remote">
            <video ref={videoRef} autoPlay playsInline />
            <div className="video-label">
                Peer {peerId.slice(0, 6)} {/* show first 6 chars of the peer ID as a label */}
            </div>
            {handRaised && <div className="hand-badge">✋</div>}
        </div>
    );
}

export default Room;
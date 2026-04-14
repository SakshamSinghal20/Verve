import React, { useEffect, useRef, useState, useCallback, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { createSocket } from "../socket";
import * as mediasoupClient from "mediasoup-client";
import "./Room.css";

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

const IconPin = ({ filled }) => (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
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

const REACTION_EMOJIS = {
    confetti: "🎉",
    clap:     "👏",
    laugh:    "😂",
    heart:    "❤️",
    fire:     "🔥",
    thumbsup: "👍",
};

// Plays a short chime via Web Audio API — no audio files needed
function playReactionChime(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const freqs = { confetti: 880, clap: 660, laugh: 784, heart: 523, fire: 740, thumbsup: 600 };
        osc.frequency.value = freqs[type] || 660;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        setTimeout(() => ctx.close(), 400);
    } catch { /* ignore audio errors silently */ }
}

let _reactionIdCounter = 0;

function peerColor(peerId) {
    const colors = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444"];
    let hash = 0;
    for (const c of peerId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
}

function RemoteVideo({ peerId, peerName, stream, handRaised, isPinned, onPin, onUnpin, isThumbnail }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
    const displayName = peerName || `Peer ${peerId.slice(0, 6)}`;

    return (
        <div className={`video-card remote ${isPinned ? "pinned-card" : ""} ${isThumbnail ? "thumbnail-card" : ""}`}>
            <video ref={videoRef} autoPlay playsInline />
            {!hasVideo && (
                <div className="cam-off-overlay">
                    <div className="cam-off-avatar" style={{ background: peerColor(peerId) }}>
                        {displayName.slice(0, 1).toUpperCase()}
                    </div>
                    {!isThumbnail && <p>{displayName}</p>}
                </div>
            )}
            <div className="video-label">{displayName}</div>
            {handRaised && <div className="hand-badge">✋</div>}
            {isPinned ? (
                <button
                    className="pin-btn pin-btn--active"
                    onClick={onUnpin}
                    title="Unpin"
                    aria-label="Unpin user"
                >
                    <IconPin filled />
                    <span>Pinned</span>
                </button>
            ) : (
                <button
                    className="pin-btn"
                    onClick={() => onPin(peerId)}
                    title="Pin to full screen"
                    aria-label="Pin user to full screen"
                >
                    <IconPin />
                    <span>Pin</span>
                </button>
            )}
        </div>
    );
}

function Room() {
    const { roomId } = useParams();
    const navigate   = useNavigate();

    const { user, loading: authLoading } = useContext(AuthContext);

    const socketRef         = useRef(null);
    const localVideoRef    = useRef(null);
    const deviceRef        = useRef(null);
    const sendTransportRef = useRef(null);
    const recvTransportRef = useRef(null);
    const streamRef        = useRef(null);
    const producersRef     = useRef([]);
    const consumersRef     = useRef([]);
    const producerToPeerRef = useRef({});
    const initializedRef   = useRef(false);

    const [status,        setStatus]        = useState("Connecting…");
    const [isMuted,       setIsMuted]       = useState(false);
    const [isCamOff,      setIsCamOff]      = useState(false);
    const [remoteStreams,  setRemoteStreams]  = useState({});

    // socketId → { userId, name } — single source of truth for all name labels
    const [peerInfo,      setPeerInfo]      = useState({});
    const myUserIdRef = useRef(null);

    const [chatOpen,     setChatOpen]     = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput,    setChatInput]    = useState("");
    const [unreadCount,  setUnreadCount]  = useState(0);
    const chatEndRef = useRef(null);

    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [peersList,        setPeersList]         = useState([]);

    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [localScreenStream, setLocalScreenStream] = useState(null);
    const screenProducerRef = useRef(null);

    const [raisedHands, setRaisedHands] = useState({});
    const raiseTimerRef = useRef(null);

    const [toast, setToast] = useState(null);
    const [isCreator, setIsCreator] = useState(false);
    const [roomEnded, setRoomEnded] = useState(false);

    // ── Reactions state ─────────────────────────────────────────────────
    const [reactions, setReactions]       = useState([]);   // active floating reactions
    const [reactionsOpen, setReactionsOpen] = useState(false);

    // ── Speaking stats state ──────────────────────────────────────────────
    const [speakingStats, setSpeakingStats] = useState({}); // userId → { ms, name }
    const [statsOpen, setStatsOpen] = useState(false);

    // ── Focus Timer state ───────────────────────────────────────────────
    const [timerState, setTimerState]       = useState(null); // { durationMs, startedAt }
    const [timerRemaining, setTimerRemaining] = useState(null); // seconds
    const [timerPickerOpen, setTimerPickerOpen] = useState(false);
    const timerIntervalRef = useRef(null);

    // pinnedInfo = { peerId, streamType: 'webcam' | 'screen' | 'local-screen' } | null
    const [pinnedInfo, setPinnedInfo] = useState(null);

    const handlePin = useCallback((peerId, streamType = 'webcam') => {
        setPinnedInfo({ peerId, streamType });
    }, []);

    const handleUnpin = useCallback(() => {
        setPinnedInfo(null);
    }, []);

    function emitAsync(event, data = {}) {
        return new Promise((resolve, reject) => {
            const sock = socketRef.current;
            if (!sock || !sock.connected) {
                return reject(new Error("Socket not connected"));
            }
            sock.emit(event, data, (response) => {
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

            consumer.track.onended = () => {
                 setRemoteStreams((prev) => ({ ...prev }));
            };

            consumersRef.current.push(consumer);
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

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate("/login", { replace: true });
            return;
        }
        if (initializedRef.current) return;
        initializedRef.current = true;

        const sock = createSocket();
        socketRef.current = sock;
        sock.connect();

        async function init() {
            try {
                setStatus("Joining room…");
                const { rtpCapabilities, isCreator: creator, myUserId, myName, timerState: ts } = await emitAsync("join-room", roomId);
                if (creator) setIsCreator(true);
                if (ts) setTimerState(ts); // sync timer for late joiners

                myUserIdRef.current = myUserId;

                const mySocketId = socketRef.current?.id;
                if (mySocketId && myUserId && myName) {
                    setPeerInfo((prev) => ({ ...prev, [mySocketId]: { userId: myUserId, name: myName } }));
                }

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
                const infoFromProducers = {};
                producers.forEach(({ peerId, userId, name }) => {
                    if (userId && name) infoFromProducers[peerId] = { userId, name };
                });
                if (Object.keys(infoFromProducers).length) {
                    setPeerInfo((prev) => ({ ...prev, ...infoFromProducers }));
                }

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

        sock.on("new-producer", async ({ producerId, peerId, userId, name, kind, appData }) => {
            if (peerId && userId && name) {
                setPeerInfo((prev) => ({ ...prev, [peerId]: { userId, name } }));
            }
            await consumeProducer(producerId, peerId, kind, appData);
        });

        sock.on("new-peer", ({ peerId, userId, name }) => {
            console.log("[Room] New peer:", name || peerId);
            if (userId && name) {
                setPeerInfo((prev) => ({ ...prev, [peerId]: { userId, name } }));
            }
        });

        sock.on("peer-left", ({ peerId }) => {
            setRemoteStreams((prev) => { const u = { ...prev }; delete u[peerId]; return u; });
            setPeerInfo((prev) => { const u = { ...prev }; delete u[peerId]; return u; });

            // Auto-unpin if the pinned user leaves
            setPinnedInfo((prev) => prev?.peerId === peerId ? null : prev);
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
                        if (consumer) streams[type].removeTrack(consumer.track);
                    }
                    return { ...prev };
                });
                // Auto-unpin if the pinned screen share producer closes
                setPinnedInfo((prev) =>
                    prev?.peerId === peerId && prev?.streamType === type ? null : prev
                );
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
            const infoMap = {};
            peers.forEach(({ peerId, userId, name }) => {
                if (peerId && name) {
                    infoMap[peerId] = { userId: userId || peerId, name };
                }
            });
            setPeerInfo((prev) => ({ ...prev, ...infoMap }));
            setPeersList(peers);

        });

        sock.on("hand-raised", ({ peerId, userId, raised }) => {
            // Key by userId so it works across multiple tabs of the same user
            const key = userId || peerId;
            setRaisedHands((prev) => {
                const updated = { ...prev };
                if (raised) updated[key] = true;
                else delete updated[key];
                return updated;
            });
        });

        // ── Reactions listener ─────────────────────────────────────────
        sock.on("reaction", ({ type, name, userId }) => {
            const id = ++_reactionIdCounter;
            const left = 10 + Math.random() * 80; // random horizontal position %
            setReactions((prev) => [...prev, { id, type, name, left }]);
            playReactionChime(type);
            // Auto-remove after animation completes
            setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
        });

        // ── Speaking stats listener ────────────────────────────────────
        sock.on("speaking-stats", ({ stats }) => {
            setSpeakingStats(stats || {});
        });

        // ── Timer listeners ──────────────────────────────────────────
        sock.on("timer-sync", (ts) => {
            setTimerState(ts);
        });

        sock.on("timer-ended", () => {
            setTimerState(null);
            showToast("Focus time complete! 🎉");
        });

        sock.on("room-closed", ({ reason }) => {
            // Guard: if creator already navigated away via handleEndMeeting, skip
            if (!sock.connected) return;
            setRoomEnded(true);
            setToast({ msg: reason || "Meeting ended by host", hide: false });
            streamRef.current?.getTracks().forEach((t) => t.stop());
            producersRef.current.forEach((p) => p.close());
            consumersRef.current.forEach((c) => c.close());
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();
            setTimeout(() => navigate("/"), 2500);
        });

        if (sock.connected) {
            init();
        } else {
            sock.once("connect", () => init());
        }

        sock.on("connect_error", (err) => {
            if (err.message === "Authentication required" || err.message === "Invalid or expired token") {
                navigate("/login", { replace: true });
            }
        });

        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            producersRef.current.forEach((p) => p.close());
            consumersRef.current.forEach((c) => c.close());
            screenProducerRef.current?.close();
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();
            if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            sock.disconnect();
        };
    }, [roomId, consumeProducer, user, authLoading]);

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
        socketRef.current?.emit("end-room");
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
                // Auto-unpin if local screen was pinned
                setPinnedInfo((prev) => prev?.streamType === 'local-screen' ? null : prev);
            };
        } catch (err) {
            if (err.name !== "NotAllowedError") console.error("[Room] Screen share error:", err);
        }
    }

    // Raise-hand state keyed by userId so both tabs of the same person reflect it
    const myUserId = myUserIdRef.current || user?.id;
    const myHandRaised = myUserId ? (raisedHands[myUserId] || false) : false;

    function toggleRaiseHand() {
        const newState = !myHandRaised;
        socketRef.current?.emit("raise-hand", { raised: newState });
        if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);
        if (newState) {
            raiseTimerRef.current = setTimeout(() => socketRef.current?.emit("raise-hand", { raised: false }), 30000);
        }
    }

    function sendReaction(type) {
        socketRef.current?.emit("send-reaction", { type });
        setReactionsOpen(false);
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
            if (!prev) {
                setUnreadCount(0);
                setParticipantsOpen(false);
                setStatsOpen(false);
            }
            return !prev;
        });
    }

    function toggleStats() {
        setStatsOpen((prev) => {
            if (!prev) {
                setParticipantsOpen(false);
                setChatOpen(false);
            }
            return !prev;
        });
    }

    function formatSpeakingTime(ms) {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    function startTimer(durationMs) {
        socketRef.current?.emit("start-timer", { durationMs });
        setTimerPickerOpen(false);
    }

    function stopTimer() {
        socketRef.current?.emit("stop-timer");
    }

    function formatTimerDisplay(seconds) {
        if (seconds == null || seconds < 0) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // ── Timer countdown tick ────────────────────────────────────────────
    useEffect(() => {
        if (!timerState) {
            setTimerRemaining(null);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            return;
        }

        function tick() {
            const elapsed = Date.now() - timerState.startedAt;
            const remainMs = timerState.durationMs - elapsed;
            setTimerRemaining(Math.max(0, Math.ceil(remainMs / 1000)));
        }

        tick(); // immediate first tick
        timerIntervalRef.current = setInterval(tick, 1000);

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [timerState]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // ── Voice Activity Detection for speaking stats ─────────────────
    useEffect(() => {
        const stream = streamRef.current;
        if (!stream || !socketRef.current) return;

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        let ctx;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch { return; }

        const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let speakingMs = 0;
        const THRESHOLD = 30; // volume level to count as "speaking"
        const POLL_MS = 200;
        const SEND_INTERVAL_MS = 3000;

        const pollId = setInterval(() => {
            // Skip counting when user is muted (track.enabled is false)
            if (!audioTrack.enabled) return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            if (avg > THRESHOLD) speakingMs += POLL_MS;
        }, POLL_MS);

        const sendId = setInterval(() => {
            if (speakingMs > 0 && socketRef.current?.connected) {
                socketRef.current.emit("speaking-update", { durationMs: speakingMs });
                speakingMs = 0;
            }
        }, SEND_INTERVAL_MS);

        return () => {
            clearInterval(pollId);
            clearInterval(sendId);
            ctx.close().catch(() => {});
        };
    }, [status]); // re-run when stream becomes active (status changes to "live")

    // Escape key to unpin + outside click to dismiss popups
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === "Escape") {
                if (pinnedInfo) handleUnpin();
                setReactionsOpen(false);
                setTimerPickerOpen(false);
            }
        }
        function onMouseDown(e) {
            // Close popups when clicking outside their wrappers
            if (!e.target.closest('.reactions-wrapper')) {
                setReactionsOpen(false);
                setTimerPickerOpen(false);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("mousedown", onMouseDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("mousedown", onMouseDown);
        };
    }, [pinnedInfo, handleUnpin]);

    const totalParticipants = 1 + Object.keys(remoteStreams).length + (localScreenStream ? 1 : 0) + Object.values(remoteStreams).filter(s => s.screen?.getVideoTracks().some(t => t.readyState === "live")).length;
    const gridClass =
        totalParticipants <= 1 ? "grid-1"
        : totalParticipants <= 2 ? "grid-2"
        : totalParticipants <= 4 ? "grid-4"
        : "grid-many";

    const statusClass = status === "live" ? "live" : status === "error" ? "error" : "pending";
    const statusLabel = status === "live" ? "Live" : status === "error" ? "Connection failed" : status;

    if (authLoading) {
        return (
            <div className="room-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#aaa", fontSize: "1.1rem" }}>Verifying session…</div>
            </div>
        );
    }

    return (
        <div className="room-container">
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

            {/* ── Focus Timer bar ──────────────────────────────────── */}
            {timerState && timerRemaining != null && (
                <div className="timer-bar">
                    <div
                        className="timer-bar-progress"
                        style={{
                            width: `${Math.max(0, (timerRemaining / (timerState.durationMs / 1000)) * 100)}%`,
                        }}
                    />
                    <div className="timer-bar-content">
                        <span className="timer-bar-icon">⏱️</span>
                        <span className="timer-bar-label">Focus Mode</span>
                        <span className="timer-bar-time">{formatTimerDisplay(timerRemaining)}</span>
                        {isCreator && (
                            <button className="timer-stop-btn" onClick={stopTimer}>Stop</button>
                        )}
                    </div>
                </div>
            )}
            {pinnedInfo ? (() => {
                // ── Pinned layout (true full-screen) ──────────────────────────
                const { peerId: pinnedPeerId, streamType } = pinnedInfo;

                // Resolve the correct stream and display name based on streamType
                let pinnedStream, pinnedName, pinnedHandKey;
                if (streamType === 'local-screen') {
                    pinnedStream  = localScreenStream;
                    pinnedName    = `Your Screen`;
                    pinnedHandKey = null;
                } else {
                    const peerStreams = remoteStreams[pinnedPeerId];
                    pinnedStream     = streamType === 'screen' ? peerStreams?.screen : peerStreams?.webcam;
                    const info       = peerInfo[pinnedPeerId];
                    pinnedHandKey    = info?.userId || pinnedPeerId;
                    const baseName   = info?.name || `Peer ${pinnedPeerId.slice(0, 6)}`;
                    pinnedName       = streamType === 'screen' ? `${baseName}'s Screen` : baseName;
                }

                return (
                    <main className="video-stage pinned-layout">
                        <div className="pinned-main">
                            {streamType === 'local-screen' ? (
                                // Local screen — render a plain video element (no RemoteVideo)
                                <div className="video-card pinned-card">
                                    <video
                                        ref={(el) => { if (el) el.srcObject = localScreenStream; }}
                                        autoPlay playsInline muted
                                    />
                                    <div className="video-label">Your Screen</div>
                                </div>
                            ) : (
                                <RemoteVideo
                                    peerId={pinnedPeerId}
                                    peerName={pinnedName}
                                    stream={pinnedStream}
                                    handRaised={!!raisedHands[pinnedHandKey]}
                                    isPinned
                                    onPin={handlePin}
                                    onUnpin={handleUnpin}
                                />
                            )}
                            <div className="pinned-banner">
                                <IconPin filled />
                                <span>{pinnedName} — Pinned</span>
                                <button className="pinned-banner-unpin" onClick={handleUnpin}>✕ Unpin</button>
                            </div>
                        </div>
                    </main>
                );
            })() : (
                // ── Default grid layout ──────────────────────────────────────
                <main className={`video-stage ${gridClass}`}>
                    <div className="video-card local">
                        <video
                            ref={localVideoRef}
                            autoPlay playsInline muted
                            className={isCamOff ? "cam-off" : ""}
                        />
                        {isCamOff && (
                            <div className="cam-off-overlay">
                                <div className="cam-off-avatar">{(user?.name || "Y").slice(0,1).toUpperCase()}</div>
                                <p>Camera Off</p>
                            </div>
                        )}
                        {isScreenSharing && <div className="screen-share-badge">Sharing screen</div>}
                        <div className="video-label">You {user?.name ? `(${user.name})` : ""}</div>
                        {myHandRaised && <div className="hand-badge">✋</div>}
                    </div>

                    {localScreenStream && (
                        <div className="video-card local screen-share">
                            <video
                                ref={(el) => { if (el) el.srcObject = localScreenStream; }}
                                autoPlay playsInline muted
                            />
                            <div className="video-label">Your Screen</div>
                            {/* Pin button on local screen share */}
                            <button
                                className="pin-btn"
                                onClick={() => handlePin('local-screen', 'local-screen')}
                                title="Pin to full screen"
                                aria-label="Pin your screen share"
                            >
                                <IconPin />
                                <span>Pin</span>
                            </button>
                        </div>
                    )}

                    {Object.entries(remoteStreams).map(([peerId, streams]) => {
                        const info = peerInfo[peerId];
                        const resolvedName = info?.name || `Peer ${peerId.slice(0, 6)}`;
                        const isSameUser = info?.userId && info.userId === myUserId;
                        const displayName = isSameUser ? `${resolvedName} (other tab)` : resolvedName;
                        const handKey = info?.userId || peerId;
                        return (
                            <React.Fragment key={peerId}>
                                <RemoteVideo
                                    peerId={peerId}
                                    peerName={displayName}
                                    stream={streams.webcam}
                                    handRaised={!!raisedHands[handKey]}
                                    isPinned={pinnedInfo?.peerId === peerId && pinnedInfo?.streamType === 'webcam'}
                                    onPin={(pid) => handlePin(pid, 'webcam')}
                                    onUnpin={handleUnpin}
                                />
                                {streams.screen && streams.screen.getVideoTracks().some(t => t.readyState === "live") && (
                                    <RemoteVideo
                                        peerId={peerId}
                                        peerName={`${displayName}'s Screen`}
                                        stream={streams.screen}
                                        handRaised={false}
                                        isPinned={pinnedInfo?.peerId === peerId && pinnedInfo?.streamType === 'screen'}
                                        onPin={(pid) => handlePin(pid, 'screen')}
                                        onUnpin={handleUnpin}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </main>
            )}

            <div className={`chat-panel ${chatOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>Chat</span>
                    <button className="chat-close" onClick={toggleChat}>✕</button>
                </div>
                <div className="chat-messages">
                    {chatMessages.length === 0 && (
                        <p className="chat-empty">No messages yet.<br />Say hi! 👋</p>
                    )}
                    {chatMessages.map((msg, i) => {
                        // Self-detection via userId — correct across multiple tabs
                        const isSelf = msg.userId
                            ? msg.userId === myUserId
                            : msg.peerId === socketRef.current?.id;
                        const senderName = isSelf
                            ? "You"
                            : (msg.name || peerInfo[msg.peerId]?.name || `Peer ${(msg.peerId || "").slice(0, 6)}`);
                        return (
                            <div key={i} className={`chat-bubble ${isSelf ? "self" : ""}`}>
                                <span className="chat-sender">{senderName}</span>
                                <p className="chat-text">{msg.message}</p>
                                <span className="chat-time">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        );
                    })}
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

            <div className={`participants-panel ${participantsOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>People ({peersList.length})</span>
                    <button className="chat-close" onClick={() => setParticipantsOpen(false)}>✕</button>
                </div>
                <div className="participants-list">
                    {peersList.map((peerEntry) => {
                        const pid = peerEntry?.peerId || peerEntry;
                        const info = peerInfo[pid] || peerEntry;
                        const name = info?.name || `Peer ${String(pid).slice(0, 6)}`;
                        const isMe = info?.userId && info.userId === myUserId;
                        return (
                            <div key={pid} className="participant-item">
                                <div className="participant-avatar" style={{ background: peerColor(pid) }}>
                                    {name.slice(0, 1).toUpperCase()}
                                </div>
                                <span className="participant-name">
                                    {isMe ? `${name} (You)` : name}
                                </span>
                                {isMe && <span className="participant-you-tag">You</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Speaking Stats panel ──────────────────────────────── */}
            <div className={`stats-panel ${statsOpen ? "open" : ""}`}>
                <div className="chat-header">
                    <span>📊 Speaking Stats</span>
                    <button className="chat-close" onClick={toggleStats}>×</button>
                </div>
                <div className="stats-list">
                    {(() => {
                        const entries = Object.entries(speakingStats);
                        if (entries.length === 0) {
                            return <p className="chat-empty">No speaking data yet.<br/>Start talking to see stats!</p>;
                        }
                        const maxMs = Math.max(...entries.map(([, v]) => v.ms), 1);
                        return entries
                            .sort((a, b) => b[1].ms - a[1].ms)
                            .map(([uid, { ms, name }]) => {
                                const pct = Math.round((ms / maxMs) * 100);
                                const isMe = uid === myUserId;
                                return (
                                    <div key={uid} className="stats-row">
                                        <div className="stats-label">
                                            <span className="stats-name">{isMe ? `${name} (You)` : name}</span>
                                            <span className="stats-time">{formatSpeakingTime(ms)}</span>
                                        </div>
                                        <div className="stats-bar">
                                            <div
                                                className={`stats-bar-fill ${isMe ? "stats-bar-me" : ""}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            });
                    })()}
                    {/* Show peers who haven't spoken */}
                    {peersList.filter(p => !speakingStats[(p.userId || p.peerId)])?.map(p => {
                        const nm = p.name || peerInfo[p.peerId]?.name || "Unknown";
                        return (
                            <div key={p.peerId} className="stats-row">
                                <div className="stats-label">
                                    <span className="stats-name stats-quiet">{nm}</span>
                                    <span className="stats-time stats-quiet">Hasn’t spoken</span>
                                </div>
                                <div className="stats-bar">
                                    <div className="stats-bar-fill" style={{ width: '0%' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

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
                    onClick={() => setParticipantsOpen((prev) => {
                        if (!prev) { setChatOpen(false); setStatsOpen(false); }
                        return !prev;
                    })}
                    title="Participants"
                    id="btn-toggle-participants"
                >
                    <IconUsers />
                    <span>People</span>
                </button>

                <button
                    className={`ctrl-btn ${statsOpen ? "active" : ""}`}
                    onClick={toggleStats}
                    title="Speaking Stats"
                    id="btn-toggle-stats"
                >
                    <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>📊</span>
                    <span>Stats</span>
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

                <div className="reactions-wrapper">
                    <button
                        className={`ctrl-btn ${reactionsOpen ? "active" : ""}`}
                        onClick={() => setReactionsOpen((p) => !p)}
                        title="Reactions"
                        id="btn-reactions"
                    >
                        <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>🎉</span>
                        <span>React</span>
                    </button>
                    {reactionsOpen && (
                        <div className="reactions-picker">
                            {Object.entries(REACTION_EMOJIS).map(([key, emoji]) => (
                                <button
                                    key={key}
                                    className="reaction-btn"
                                    onClick={() => sendReaction(key)}
                                    title={key}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {isCreator && (
                    <div className="reactions-wrapper">
                        <button
                            className={`ctrl-btn ${timerState ? "active" : ""}`}
                            onClick={() => timerState ? stopTimer() : setTimerPickerOpen((p) => !p)}
                            title={timerState ? "Stop timer" : "Start focus timer"}
                            id="btn-focus-timer"
                        >
                            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>⏱️</span>
                            <span>{timerState ? "Stop" : "Focus"}</span>
                        </button>
                        {timerPickerOpen && !timerState && (
                            <div className="timer-picker">
                                <div className="timer-picker-title">Focus Timer</div>
                                {[5, 15, 25, 45].map((min) => (
                                    <button
                                        key={min}
                                        className="timer-preset-btn"
                                        onClick={() => startTimer(min * 60 * 1000)}
                                    >
                                        {min} min
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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

            {/* ── Floating reactions overlay ─────────────────────────── */}
            <div className="reactions-overlay" aria-hidden="true">
                {reactions.map((r) => (
                    <div
                        key={r.id}
                        className="reaction-float"
                        style={{ left: `${r.left}%` }}
                    >
                        <span className="reaction-float-emoji">{REACTION_EMOJIS[r.type]}</span>
                        <span className="reaction-float-name">{r.name}</span>
                    </div>
                ))}
            </div>

            {toast && (
                <div className={`room-toast ${toast.hide ? "hide" : ""}`}>
                    ✓ {toast.msg}
                </div>
            )}
        </div>
    );
}

export default Room;
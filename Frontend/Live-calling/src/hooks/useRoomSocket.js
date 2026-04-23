import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as mediasoupClient from "mediasoup-client";
import { createSocket } from "../socket";

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum ms accepted from a single speaking-update to prevent abuse. */
const MAX_SPEAKING_UPDATE_MS = 10_000;

/** How often the VAD polls the audio analyser (ms). */
const VAD_POLL_MS = 200;

/** How often accumulated speaking time is sent to the server (ms). */
const VAD_SEND_INTERVAL_MS = 3_000;

/** Audio volume threshold (0–255) to count as "speaking". */
const VAD_SPEAKING_THRESHOLD = 30;

/** How long a raised hand is auto-lowered after (ms). */
const HAND_AUTO_LOWER_MS = 30_000;

/** Max floating reactions kept in state before old ones are removed. */
const REACTION_TTL_MS = 3_000;

let _reactionIdCounter = 0;

// ── Utility ────────────────────────────────────────────────────────────────

/** Plays a short chime via Web Audio API — no audio files needed. */
function playReactionChime(type) {
    try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
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

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * useRoomSocket — encapsulates all mediasoup + socket.io logic for a room.
 *
 * Returns an object containing reactive state and action callbacks that
 * Room.jsx can use without knowing about the underlying socket/transport layer.
 */
export default function useRoomSocket(roomId, user, authLoading) {
    const navigate = useNavigate();

    // ── Refs (not reactive — used inside callbacks) ────────────────────────
    const socketRef          = useRef(null);
    const localVideoRef      = useRef(null);
    const deviceRef          = useRef(null);
    const sendTransportRef   = useRef(null);
    const recvTransportRef   = useRef(null);
    const streamRef          = useRef(null);
    const producersRef       = useRef([]);
    const consumersRef       = useRef([]);
    const producerToPeerRef  = useRef({});
    const initializedRef     = useRef(false);
    const screenProducerRef  = useRef(null);
    const raiseTimerRef      = useRef(null);
    const timerIntervalRef   = useRef(null);
    const myUserIdRef        = useRef(null);

    // ── Reactive state ─────────────────────────────────────────────────────
    const [status,          setStatus]          = useState("Connecting…");
    const [isMuted,         setIsMuted]         = useState(false);
    const [isCamOff,        setIsCamOff]        = useState(false);
    const [remoteStreams,   setRemoteStreams]    = useState({});
    const [peerInfo,        setPeerInfo]        = useState({}); // socketId → { userId, name }
    const [chatMessages,    setChatMessages]    = useState([]);
    const [peersList,       setPeersList]       = useState([]);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [localScreenStream, setLocalScreenStream] = useState(null);
    const [raisedHands,     setRaisedHands]     = useState({});
    const [isCreator,       setIsCreator]       = useState(false);
    const [roomEnded,       setRoomEnded]       = useState(false);
    const [reactions,       setReactions]       = useState([]);
    const [speakingStats,   setSpeakingStats]   = useState({});
    const [timerState,      setTimerState]      = useState(null);
    const [timerRemaining,  setTimerRemaining]  = useState(null);
    const [toast,           setToast]           = useState(null);
    const [pinnedInfo,      setPinnedInfo]      = useState(null);

    // ── Helpers ────────────────────────────────────────────────────────────

    function showToast(msg) {
        setToast({ msg, hide: false });
        setTimeout(() => setToast((t) => t ? { ...t, hide: true } : null), 2200);
        setTimeout(() => setToast(null), 2500);
    }

    /** Wraps socket.emit as a Promise, rejecting on error responses. */
    function emitAsync(event, data = {}) {
        return new Promise((resolve, reject) => {
            const sock = socketRef.current;
            if (!sock || !sock.connected) return reject(new Error("Socket not connected"));
            sock.emit(event, data, (response) => {
                if (response?.error) reject(new Error(response.error));
                else resolve(response);
            });
        });
    }

    // ── consumeProducer ────────────────────────────────────────────────────

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

            consumer.track.onended = () => setRemoteStreams((prev) => ({ ...prev }));
            consumersRef.current.push(consumer);
            producerToPeerRef.current[producerId] = {
                peerId,
                type: appData?.type === "screen" ? "screen" : "webcam",
            };

            setRemoteStreams((prev) => {
                const existing = prev[peerId] || { webcam: new MediaStream(), screen: new MediaStream() };
                if (appData?.type === "screen") {
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

    // ── Main init + socket listener effect ────────────────────────────────

    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate("/login", { replace: true }); return; }
        if (initializedRef.current) return;
        initializedRef.current = true;

        const sock = createSocket();
        socketRef.current = sock;
        sock.connect();

        // ── Room initialisation ──────────────────────────────────────────
        async function init() {
            try {
                setStatus("Joining room…");
                const { rtpCapabilities, isCreator: creator, myUserId, myName, timerState: ts }
                    = await emitAsync("join-room", roomId);

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
                if (videoTrack) producersRef.current.push(await sendTransport.produce({ track: videoTrack }));

                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) producersRef.current.push(await sendTransport.produce({ track: audioTrack }));

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

        // ── Socket event listeners ───────────────────────────────────────
        sock.on("new-producer", async ({ producerId, peerId, userId, name, kind, appData }) => {
            if (peerId && userId && name) setPeerInfo((prev) => ({ ...prev, [peerId]: { userId, name } }));
            await consumeProducer(producerId, peerId, kind, appData);
        });

        sock.on("new-peer", ({ peerId, userId, name }) => {
            if (userId && name) setPeerInfo((prev) => ({ ...prev, [peerId]: { userId, name } }));
        });

        sock.on("peer-left", ({ peerId }) => {
            setRemoteStreams((prev) => { const u = { ...prev }; delete u[peerId]; return u; });
            setPeerInfo((prev)       => { const u = { ...prev }; delete u[peerId]; return u; });
            setPinnedInfo((prev) => prev?.peerId === peerId ? null : prev);
        });

        sock.on("producer-closed", ({ producerId }) => {
            const mapping  = producerToPeerRef.current[producerId];
            const consumer = consumersRef.current.find((c) => c.producerId === producerId);
            if (consumer) { consumer.track.stop(); consumer.close(); }
            if (mapping) {
                const { peerId, type } = mapping;
                setRemoteStreams((prev) => {
                    const streams = prev[peerId];
                    if (streams?.[type] && consumer) streams[type].removeTrack(consumer.track);
                    return { ...prev };
                });
                setPinnedInfo((prev) =>
                    prev?.peerId === peerId && prev?.streamType === type ? null : prev
                );
                delete producerToPeerRef.current[producerId];
            }
            consumersRef.current = consumersRef.current.filter((c) => c.producerId !== producerId);
        });

        sock.on("new-message",    (msg) => {
            setChatMessages((prev) => [...prev, msg]);
            // Only increment unread when chat is closed — Room.jsx manages chatOpen state
            // so we expose a `onNewMessage` callback instead
        });

        sock.on("peers-list", ({ peers }) => {
            const infoMap = {};
            peers.forEach(({ peerId, userId, name }) => {
                if (peerId && name) infoMap[peerId] = { userId: userId || peerId, name };
            });
            setPeerInfo((prev) => ({ ...prev, ...infoMap }));
            setPeersList(peers);
        });

        sock.on("hand-raised", ({ peerId, userId, raised }) => {
            const key = userId || peerId;
            setRaisedHands((prev) => {
                const updated = { ...prev };
                if (raised) updated[key] = true;
                else delete updated[key];
                return updated;
            });
        });

        sock.on("reaction", ({ type, name }) => {
            const id   = ++_reactionIdCounter;
            const left = 10 + Math.random() * 80;
            setReactions((prev) => [...prev, { id, type, name, left }]);
            playReactionChime(type);
            setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), REACTION_TTL_MS);
        });

        sock.on("speaking-stats", ({ stats }) => setSpeakingStats(stats || {}));

        sock.on("timer-sync",  (ts) => setTimerState(ts));
        sock.on("timer-ended", ()   => {
            setTimerState(null);
            showToast("Focus time complete! 🎉");
        });

        sock.on("room-closed", ({ reason }) => {
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

        sock.on("connect_error", (err) => {
            if (err.message === "Authentication required" || err.message === "Invalid or expired token") {
                navigate("/login", { replace: true });
            }
        });

        if (sock.connected) init();
        else sock.once("connect", () => init());

        // ── Cleanup ──────────────────────────────────────────────────────
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            producersRef.current.forEach((p) => p.close());
            consumersRef.current.forEach((c) => c.close());
            screenProducerRef.current?.close();
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();
            if (raiseTimerRef.current)  clearTimeout(raiseTimerRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            sock.disconnect();
        };
    }, [roomId, consumeProducer, user, authLoading, navigate]);

    // ── Timer countdown tick ───────────────────────────────────────────────
    useEffect(() => {
        if (!timerState) {
            setTimerRemaining(null);
            if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
            return;
        }
        function tick() {
            const elapsed  = Date.now() - timerState.startedAt;
            const remainMs = timerState.durationMs - elapsed;
            setTimerRemaining(Math.max(0, Math.ceil(remainMs / 1000)));
        }
        tick();
        timerIntervalRef.current = setInterval(tick, 1000);
        return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } };
    }, [timerState]);

    // ── Voice Activity Detection ───────────────────────────────────────────
    useEffect(() => {
        const stream     = streamRef.current;
        const sock       = socketRef.current;
        if (!stream || !sock) return;
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        let ctx;
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch { return; }

        const source   = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let speakingMs = 0;

        const pollId = setInterval(() => {
            if (!audioTrack.enabled) return; // skip when muted
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            if (avg > VAD_SPEAKING_THRESHOLD) speakingMs += VAD_POLL_MS;
        }, VAD_POLL_MS);

        const sendId = setInterval(() => {
            if (speakingMs > 0 && sock.connected) {
                sock.emit("speaking-update", { durationMs: Math.min(speakingMs, MAX_SPEAKING_UPDATE_MS) });
                speakingMs = 0;
            }
        }, VAD_SEND_INTERVAL_MS);

        return () => {
            clearInterval(pollId);
            clearInterval(sendId);
            ctx.close().catch(() => {});
        };
    }, [status]); // re-runs when stream becomes active (status → "live")

    // ── Escape / outside-click for popups ─────────────────────────────────
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key !== "Escape") return;
            if (pinnedInfo) setPinnedInfo(null);
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [pinnedInfo]);

    // ── Action callbacks ───────────────────────────────────────────────────

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
            const screenStream  = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
            const screenTrack   = screenStream.getVideoTracks()[0];
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
                setPinnedInfo((prev) => prev?.streamType === "local-screen" ? null : prev);
            };
        } catch (err) {
            if (err.name !== "NotAllowedError") console.error("[Room] Screen share error:", err);
        }
    }

    function toggleRaiseHand() {
        const myUserId   = myUserIdRef.current || user?.id;
        const myHandRaised = myUserId ? (raisedHands[myUserId] || false) : false;
        const newState   = !myHandRaised;
        socketRef.current?.emit("raise-hand", { raised: newState });
        if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);
        if (newState) {
            raiseTimerRef.current = setTimeout(
                () => socketRef.current?.emit("raise-hand", { raised: false }),
                HAND_AUTO_LOWER_MS
            );
        }
    }

    function sendReaction(type) {
        socketRef.current?.emit("send-reaction", { type });
    }

    function sendChatMessage(text) {
        if (!text.trim()) return;
        const sock = socketRef.current;
        if (!sock || !sock.connected) return;
        sock.emit("send-message", { message: text }, (res) => {
            if (res?.error) console.error("[Room] Chat send error:", res.error);
        });
    }

    function startTimer(durationMs) {
        socketRef.current?.emit("start-timer", { durationMs });
    }

    function stopTimer() {
        socketRef.current?.emit("stop-timer");
    }

    function copyRoomLink() {
        const url = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(url).then(() => showToast("Room link copied!"));
    }

    const handlePin   = useCallback((peerId, streamType = "webcam") => setPinnedInfo({ peerId, streamType }), []);
    const handleUnpin = useCallback(() => setPinnedInfo(null), []);

    const myUserId    = myUserIdRef.current || user?.id;
    const myHandRaised = myUserId ? (raisedHands[myUserId] || false) : false;

    return {
        // Refs exposed to JSX
        localVideoRef,
        socketRef,
        // Reactive state
        status,
        isMuted,
        isCamOff,
        remoteStreams,
        peerInfo,
        chatMessages,
        setChatMessages,
        peersList,
        isScreenSharing,
        localScreenStream,
        raisedHands,
        isCreator,
        roomEnded,
        reactions,
        speakingStats,
        timerState,
        timerRemaining,
        toast,
        setToast,
        pinnedInfo,
        myUserId,
        myHandRaised,
        // Actions
        toggleMute,
        toggleCamera,
        handleLeave,
        handleEndMeeting,
        toggleScreenShare,
        toggleRaiseHand,
        sendReaction,
        sendChatMessage,
        startTimer,
        stopTimer,
        copyRoomLink,
        handlePin,
        handleUnpin,
    };
}

import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { EmbedContext } from "../context/EmbedContext";
import useRoomSocket from "../hooks/useRoomSocket";
import VideoGrid          from "../components/VideoGrid";
import ControlBar         from "../components/ControlBar";
import TimerBar           from "../components/TimerBar";
import ChatPanel          from "../components/ChatPanel";
import ParticipantsPanel  from "../components/ParticipantsPanel";
import SpeakingStatsPanel from "../components/SpeakingStatsPanel";
import ReactionOverlay    from "../components/ReactionOverlay";
import { IconUsers, IconCopy } from "../components/Icons";
import decodeJwt from "../utils/decodeJwt";

import "./Room.css";
import "./EmbedRoom.css";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function EmbedRoom() {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    // ── Decode embed JWT for UI/branding only (constraint 5) ─────────────
    // NEVER used for authorization — server verifies the token independently.
    const decoded = token ? decodeJwt(token) : null;

    // ── Build centralized embed context value (constraint 2) ─────────────
    // All embed-mode branching in child components uses useEmbed(), not props.
    const embedCtxValue = {
        isEmbedMode: true,
        embedToken:  token,
        tenantId:    decoded?.tenantId || null,
        roomId:      decoded?.roomId   || null,
        role:        decoded?.role     || "participant",
    };

    // Guest identity derived from token claims (UI convenience only)
    const embedUser = decoded
        ? { id: decoded.guestId, name: decoded.guestName || "Guest" }
        : null;

    // ── Tenant branding ────────────────────────────────────────────────────
    const [branding, setBranding] = useState(null);

    useEffect(() => {
        if (!decoded?.tenantId) return;
        fetch(`${API_URL}/api/tenant/branding/${decoded.tenantId}`)
            .then((r) => {
                if (!r.ok) throw new Error("Branding fetch failed");
                return r.json();
            })
            .then(setBranding)
            .catch(() => {
                // Non-fatal: fallback to default Verve branding
                console.warn("[EmbedRoom] Could not load tenant branding");
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [decoded?.tenantId]);

    // Apply tenant primary color as a CSS custom property (constraint 5:
    // branding is UI-only; no authorization logic depends on this value)
    useEffect(() => {
        if (!branding?.primaryColor) return;
        document.documentElement.style.setProperty("--embed-primary", branding.primaryColor);
        return () => document.documentElement.style.removeProperty("--embed-primary");
    }, [branding?.primaryColor]);

    // ── Panel state ────────────────────────────────────────────────────────
    const [chatOpen,         setChatOpen]        = useState(false);
    const [chatInput,        setChatInput]       = useState("");
    const [unreadCount,      setUnreadCount]     = useState(0);
    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [statsOpen,        setStatsOpen]       = useState(false);
    const [reactionsOpen,    setReactionsOpen]   = useState(false);
    const [timerPickerOpen,  setTimerPickerOpen] = useState(false);

    // ── Reuse existing socket/mediasoup hook — no duplicate meeting engine ─
    // forceEmbedMode=true: never redirect to /login even if token is null/malformed;
    // error display is handled above by the access-denied card.
    const room = useRoomSocket(roomId, embedUser, false, token, true);

    // ── Derived values ─────────────────────────────────────────────────────
    const statusClass = room.status === "live" ? "live" : room.status === "error" ? "error" : "pending";
    const statusLabel = room.status === "live" ? "Live" : room.status === "error" ? "Connection failed" : room.status;

    const totalParticipants =
        1 +
        Object.keys(room.remoteStreams).length +
        (room.localScreenStream ? 1 : 0) +
        Object.values(room.remoteStreams).filter(
            (s) => s.screen?.getVideoTracks().some((t) => t.readyState === "live")
        ).length;

    // ── Panel toggle helpers ────────────────────────────────────────────────
    function toggleChat() {
        setChatOpen((prev) => {
            if (!prev) { setUnreadCount(0); setParticipantsOpen(false); setStatsOpen(false); }
            return !prev;
        });
    }

    function toggleParticipants() {
        setParticipantsOpen((prev) => {
            if (!prev) { setChatOpen(false); setStatsOpen(false); }
            return !prev;
        });
    }

    function toggleStats() {
        setStatsOpen((prev) => {
            if (!prev) { setChatOpen(false); setParticipantsOpen(false); }
            return !prev;
        });
    }

    function handleSendMessage() {
        room.sendChatMessage(chatInput);
        setChatInput("");
    }

    function handleSendReaction(type) {
        room.sendReaction(type);
        setReactionsOpen(false);
    }

    function handleStartTimer(durationMs) {
        room.startTimer(durationMs);
        setTimerPickerOpen(false);
    }

    // Unread badge
    const prevMsgCount = useRef(0);
    useEffect(() => {
        const current = room.chatMessages.length;
        if (current > prevMsgCount.current && !chatOpen) {
            setUnreadCount((c) => c + (current - prevMsgCount.current));
        }
        prevMsgCount.current = current;
    }, [room.chatMessages.length, chatOpen]);

    // ── Access denied (missing or invalid token) ───────────────────────────
    if (!token || !decoded) {
        return (
            // Still provide embed context so any nested component knows the mode
            <EmbedContext.Provider value={embedCtxValue}>
                <div className="room-container embed-container"
                     style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="embed-error-card">
                        <h2>Access Denied</h2>
                        <p>A valid embed token is required to join this meeting.</p>
                    </div>
                </div>
            </EmbedContext.Provider>
        );
    }

    return (
        // Provide centralized embed context to the entire component tree (constraint 2)
        <EmbedContext.Provider value={embedCtxValue}>
            <div className="room-container embed-container">

                {/* ── Branded Header ─────────────────────────────────────── */}
                <header className="room-header embed-header">
                    <div className="embed-brand">
                        {branding?.logo && (
                            <img src={branding.logo} alt={branding.name} className="embed-logo" />
                        )}
                        <span className="room-logo">
                            {branding?.name || "Meeting"}
                        </span>
                    </div>

                    <div className="room-id-badge" title="Room ID">
                        <span className="room-id-label">Room</span>
                        <span className="room-id-value">{roomId}</span>
                        <button className="copy-btn" onClick={room.copyRoomLink} title="Copy invite link">
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

                {/* ── Timer ──────────────────────────────────────────────── */}
                <TimerBar
                    timerState={room.timerState}
                    timerRemaining={room.timerRemaining}
                    isCreator={room.isCreator}
                    onStop={room.stopTimer}
                />

                {/* ── Video Grid ─────────────────────────────────────────── */}
                <VideoGrid
                    localVideoRef={room.localVideoRef}
                    localScreenStream={room.localScreenStream}
                    remoteStreams={room.remoteStreams}
                    peerInfo={room.peerInfo}
                    raisedHands={room.raisedHands}
                    pinnedInfo={room.pinnedInfo}
                    isCamOff={room.isCamOff}
                    isScreenSharing={room.isScreenSharing}
                    myHandRaised={room.myHandRaised}
                    myUserId={room.myUserId}
                    userName={embedUser?.name}
                    onPin={room.handlePin}
                    onUnpin={room.handleUnpin}
                />

                {/* ── Side Panels ────────────────────────────────────────── */}
                <ChatPanel
                    isOpen={chatOpen}
                    onClose={toggleChat}
                    messages={room.chatMessages}
                    chatInput={chatInput}
                    onInputChange={setChatInput}
                    onSend={handleSendMessage}
                    myUserId={room.myUserId}
                    mySocketId={room.socketRef.current?.id}
                    peerInfo={room.peerInfo}
                />

                <ParticipantsPanel
                    isOpen={participantsOpen}
                    onClose={() => setParticipantsOpen(false)}
                    peersList={room.peersList}
                    peerInfo={room.peerInfo}
                    myUserId={room.myUserId}
                />

                <SpeakingStatsPanel
                    isOpen={statsOpen}
                    onClose={toggleStats}
                    speakingStats={room.speakingStats}
                    peersList={room.peersList}
                    peerInfo={room.peerInfo}
                    myUserId={room.myUserId}
                />

                {/* ── Control Bar ────────────────────────────────────────── */}
                <ControlBar
                    isMuted={room.isMuted}
                    isCamOff={room.isCamOff}
                    isScreenSharing={room.isScreenSharing}
                    chatOpen={chatOpen}
                    unreadCount={unreadCount}
                    participantsOpen={participantsOpen}
                    statsOpen={statsOpen}
                    myHandRaised={room.myHandRaised}
                    reactionsOpen={reactionsOpen}
                    timerState={room.timerState}
                    timerPickerOpen={timerPickerOpen}
                    isCreator={room.isCreator}
                    onToggleMute={room.toggleMute}
                    onToggleCamera={room.toggleCamera}
                    onToggleScreen={room.toggleScreenShare}
                    onToggleChat={toggleChat}
                    onToggleParticipants={toggleParticipants}
                    onToggleStats={toggleStats}
                    onToggleRaiseHand={room.toggleRaiseHand}
                    onToggleReactions={() => setReactionsOpen((p) => !p)}
                    onSendReaction={handleSendReaction}
                    onToggleTimerPicker={() => setTimerPickerOpen((p) => !p)}
                    onStartTimer={handleStartTimer}
                    onStopTimer={room.stopTimer}
                    onLeave={room.handleLeave}
                    onEndMeeting={room.handleEndMeeting}
                />

                {/* ── Room-ended overlay ─────────────────────────────────── */}
                {room.roomEnded && (
                    <div className="room-ended-overlay">
                        <div className="room-ended-card">
                            <div className="room-ended-icon">📞</div>
                            <h2>Meeting Ended</h2>
                            <p>This meeting session has ended.</p>
                            <p className="room-ended-sub">You may close this window.</p>
                        </div>
                    </div>
                )}

                {/* ── Reactions ──────────────────────────────────────────── */}
                <ReactionOverlay reactions={room.reactions} />

                {/* ── Toast ──────────────────────────────────────────────── */}
                {room.toast && (
                    <div className={`room-toast ${room.toast.hide ? "hide" : ""}`}>
                        ✓ {room.toast.msg}
                    </div>
                )}

                {/* ── Powered-by badge ───────────────────────────────────── */}
                <div className="embed-powered-by">
                    Powered by <strong>Verve</strong>
                </div>
            </div>
        </EmbedContext.Provider>
    );
}

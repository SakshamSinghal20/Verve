import React, { useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

import useRoomSocket from "../hooks/useRoomSocket";
import VideoGrid     from "../components/VideoGrid";
import ControlBar    from "../components/ControlBar";
import TimerBar      from "../components/TimerBar";
import RoomPulse     from "../components/RoomPulse";
import ChatPanel     from "../components/ChatPanel";
import ParticipantsPanel   from "../components/ParticipantsPanel";
import SpeakingStatsPanel  from "../components/SpeakingStatsPanel";
import ReactionOverlay     from "../components/ReactionOverlay";
import { IconUsers, IconCopy } from "../components/Icons";

import "./Room.css";

export default function Room() {
    const { roomId } = useParams();
    const { user, loading: authLoading } = useContext(AuthContext);

    // ── Panel open/close state (UI-only, belongs in the view layer) ────────
    const [chatOpen,         setChatOpen]         = useState(false);
    const [chatInput,        setChatInput]         = useState("");
    const [unreadCount,      setUnreadCount]       = useState(0);
    const [participantsOpen, setParticipantsOpen]  = useState(false);
    const [statsOpen,        setStatsOpen]         = useState(false);
    const [reactionsOpen,    setReactionsOpen]     = useState(false);
    const [timerPickerOpen,  setTimerPickerOpen]   = useState(false);

    // ── All socket/mediasoup logic lives in the hook ───────────────────────
    const room = useRoomSocket(roomId, user, authLoading);

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

    // ── Panel toggle helpers ───────────────────────────────────────────────

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

    // Increment unread badge whenever new messages arrive while chat is closed
    const prevMsgCount = React.useRef(0);
    React.useEffect(() => {
        const current = room.chatMessages.length;
        if (current > prevMsgCount.current && !chatOpen) {
            setUnreadCount((c) => c + (current - prevMsgCount.current));
        }
        prevMsgCount.current = current;
    }, [room.chatMessages.length, chatOpen]);

    // ── Loading screen ─────────────────────────────────────────────────────
    if (authLoading) {
        return (
            <div className="room-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#aaa", fontSize: "1.1rem" }}>Verifying session…</div>
            </div>
        );
    }

    return (
        <div className="room-container">
            {/* ── Header ───────────────────────────────────────────────── */}
            <header className="room-header">
                <span className="room-logo">Verve</span>

                <div className="room-id-badge" title="Click copy button to share this room">
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

            {/* ── Focus timer progress bar ──────────────────────────────── */}
            <TimerBar
                timerState={room.timerState}
                timerRemaining={room.timerRemaining}
                isCreator={room.isCreator}
                onStop={room.stopTimer}
            />

            {/* ── Video area ────────────────────────────────────────────── */}
            <RoomPulse
                totalParticipants={totalParticipants}
                raisedHands={room.raisedHands}
                speakingStats={room.speakingStats}
                timerState={room.timerState}
                timerRemaining={room.timerRemaining}
                isScreenSharing={room.isScreenSharing}
                pinnedInfo={room.pinnedInfo}
            />

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
                userName={user?.name}
                onPin={room.handlePin}
                onUnpin={room.handleUnpin}
            />

            {/* ── Side panels ───────────────────────────────────────────── */}
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

            {/* ── Control bar ───────────────────────────────────────────── */}
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

            {/* ── Room-ended overlay ────────────────────────────────────── */}
            {room.roomEnded && (
                <div className="room-ended-overlay">
                    <div className="room-ended-card">
                        <div className="room-ended-icon">📞</div>
                        <h2>Meeting Ended</h2>
                        <p>The host has ended this meeting.</p>
                        <p className="room-ended-sub">Redirecting you to the home page…</p>
                    </div>
                </div>
            )}

            {/* ── Floating reactions ────────────────────────────────────── */}
            <ReactionOverlay reactions={room.reactions} />

            {/* ── Toast notification ───────────────────────────────────── */}
            {room.toast && (
                <div className={`room-toast ${room.toast.hide ? "hide" : ""}`}>
                    ✓ {room.toast.msg}
                </div>
            )}
        </div>
    );
}

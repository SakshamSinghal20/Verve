/**
 * VerveRoom — Prebuilt full meeting room component for SDK consumers.
 *
 * State authority (constraint 2):
 *   useRoomSocket is the ONLY authoritative source of room/media state.
 *   VerveSession acts as an orchestrator: config, events, lifecycle.
 *   No duplicate state stores.
 *
 * Architecture:
 *   VerveSession (config + events + lifecycle)
 *       ↓ context
 *   VerveRoom
 *       ↓ calls
 *   useRoomSocket (authoritative state)
 *       ↓ renders
 *   Existing UI components (VideoGrid, ControlBar, etc.)
 *
 * Usage:
 *   <VerveProvider session={session}>
 *     <VerveRoom />
 *   </VerveProvider>
 */

import React, { useState, useEffect, useRef } from "react";
import { useVerveSession } from "./VerveProvider";
import { SdkEvent } from "./VerveSession";

import useRoomSocket      from "../hooks/useRoomSocket";
import VideoGrid          from "../components/VideoGrid";
import ControlBar         from "../components/ControlBar";
import TimerBar           from "../components/TimerBar";
import ChatPanel          from "../components/ChatPanel";
import ParticipantsPanel  from "../components/ParticipantsPanel";
import SpeakingStatsPanel from "../components/SpeakingStatsPanel";
import ReactionOverlay    from "../components/ReactionOverlay";
import { IconUsers, IconCopy } from "../components/Icons";

import "../pages/Room.css";
import "./VerveTheme.css";

export default function VerveRoom() {
    const session = useVerveSession();

    // Signal to session that useRoomSocket is the state authority (constraint 2)
    useEffect(() => {
        session._enterComponentMode();
    }, [session]);

    // Build user object from session config
    const user = { id: session.guestId, name: session.guestName };

    // ── useRoomSocket is the SINGLE authoritative state source ──────────
    const room = useRoomSocket(
        session.roomId,
        user,
        false,           // authLoading
        session._token,  // embed token
        true             // forceEmbedMode
    );

    // ── Forward hook state changes to SDK events (constraint 8) ─────────
    // This is the event translation layer: hook state → SDK events.
    // No state duplication — we only observe and emit.

    const prevPeersRef = useRef({});
    useEffect(() => {
        const prev = prevPeersRef.current;
        const curr = room.peerInfo || {};

        Object.keys(curr).forEach((peerId) => {
            if (!prev[peerId]) {
                session._emitSdkEvent(SdkEvent.PARTICIPANT_JOINED, {
                    id: peerId,
                    name: curr[peerId]?.name || "Unknown",
                });
            }
        });

        Object.keys(prev).forEach((peerId) => {
            if (!curr[peerId]) {
                session._emitSdkEvent(SdkEvent.PARTICIPANT_LEFT, {
                    id: peerId,
                    name: prev[peerId]?.name || "Unknown",
                });
            }
        });

        prevPeersRef.current = { ...curr };
    }, [room.peerInfo, session]);

    // Chat messages → SDK events (observe only, no duplication)
    const prevMsgLen = useRef(0);
    useEffect(() => {
        if (room.chatMessages.length > prevMsgLen.current) {
            const newMsgs = room.chatMessages.slice(prevMsgLen.current);
            newMsgs.forEach((msg) => session._emitSdkEvent(SdkEvent.CHAT_MESSAGE, msg));
        }
        prevMsgLen.current = room.chatMessages.length;
    }, [room.chatMessages, session]);

    // Room connected
    useEffect(() => {
        if (room.status === "live") {
            session._emitSdkEvent(SdkEvent.ROOM_CONNECTED, { roomId: session.roomId });
        }
    }, [room.status, session]);

    // Room ended
    useEffect(() => {
        if (room.roomEnded) {
            session._emitSdkEvent(SdkEvent.ROOM_ENDED, { roomId: session.roomId });
        }
    }, [room.roomEnded, session]);

    // ── Panel state (UI-only, not duplicated anywhere) ──────────────────
    const [chatOpen,         setChatOpen]         = useState(false);
    const [chatInput,        setChatInput]        = useState("");
    const [unreadCount,      setUnreadCount]      = useState(0);
    const [participantsOpen, setParticipantsOpen] = useState(false);
    const [statsOpen,        setStatsOpen]        = useState(false);
    const [reactionsOpen,    setReactionsOpen]    = useState(false);
    const [timerPickerOpen,  setTimerPickerOpen]  = useState(false);

    // Derived from authoritative hook state
    const statusClass = room.status === "live" ? "live" : room.status === "error" ? "error" : "pending";
    const statusLabel = room.status === "live" ? "Live" : room.status === "error" ? "Connection failed" : room.status;

    const totalParticipants =
        1 +
        Object.keys(room.remoteStreams).length +
        (room.localScreenStream ? 1 : 0) +
        Object.values(room.remoteStreams).filter(
            (s) => s.screen?.getVideoTracks().some((t) => t.readyState === "live")
        ).length;

    // Panel toggles
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
    const unreadRef = useRef(0);
    useEffect(() => {
        const current = room.chatMessages.length;
        if (current > unreadRef.current && !chatOpen) {
            setUnreadCount((c) => c + (current - unreadRef.current));
        }
        unreadRef.current = current;
    }, [room.chatMessages.length, chatOpen]);

    return (
        <div className="verve-container room-container">
            {/* ── Header ──────────────────────────────────────────────── */}
            <header className="room-header">
                <span className="room-logo">Verve</span>

                <div className="room-id-badge" title="Room ID">
                    <span className="room-id-label">Room</span>
                    <span className="room-id-value">{session.roomId}</span>
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

            <TimerBar
                timerState={room.timerState}
                timerRemaining={room.timerRemaining}
                isCreator={room.isCreator}
                onStop={room.stopTimer}
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
                userName={session.guestName}
                onPin={room.handlePin}
                onUnpin={room.handleUnpin}
            />

            {session.config.chatEnabled && (
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
            )}

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
                onToggleCamera={session.config.cameraEnabled ? room.toggleCamera : undefined}
                onToggleScreen={session.config.screenShareEnabled ? room.toggleScreenShare : undefined}
                onToggleChat={session.config.chatEnabled ? toggleChat : undefined}
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

            {room.roomEnded && (
                <div className="room-ended-overlay">
                    <div className="room-ended-card">
                        <div className="room-ended-icon">📞</div>
                        <h2>Meeting Ended</h2>
                        <p>This meeting session has ended.</p>
                    </div>
                </div>
            )}

            <ReactionOverlay reactions={room.reactions} />

            {room.toast && (
                <div className={`room-toast ${room.toast.hide ? "hide" : ""}`}>
                    ✓ {room.toast.msg}
                </div>
            )}

            <div className="verve-powered-by">
                Powered by <strong>Verve</strong>
            </div>
        </div>
    );
}

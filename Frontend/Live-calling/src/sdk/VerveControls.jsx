/**
 * VerveControls — Standalone prebuilt control bar for SDK consumers.
 *
 * Wraps the existing ControlBar component with SDK session integration.
 * Useful when developers want to build a custom layout but reuse
 * the standard Verve control bar.
 *
 * Usage:
 *   <VerveProvider session={session}>
 *     <VerveControls room={room} />
 *   </VerveProvider>
 */

import React, { useState } from "react";
import { useVerveSession } from "./VerveProvider";
import ControlBar from "../components/ControlBar";

/**
 * @param {Object} props
 * @param {Object} props.room — return value of useRoomSocket()
 */
export default function VerveControls({ room }) {
    const session = useVerveSession();

    const [reactionsOpen,   setReactionsOpen]   = useState(false);
    const [timerPickerOpen, setTimerPickerOpen] = useState(false);

    function handleSendReaction(type) {
        room.sendReaction(type);
        setReactionsOpen(false);
    }

    function handleStartTimer(durationMs) {
        room.startTimer(durationMs);
        setTimerPickerOpen(false);
    }

    return (
        <ControlBar
            isMuted={room.isMuted}
            isCamOff={room.isCamOff}
            isScreenSharing={room.isScreenSharing}
            chatOpen={false}
            unreadCount={0}
            participantsOpen={false}
            statsOpen={false}
            myHandRaised={room.myHandRaised}
            reactionsOpen={reactionsOpen}
            timerState={room.timerState}
            timerPickerOpen={timerPickerOpen}
            isCreator={room.isCreator}
            onToggleMute={room.toggleMute}
            onToggleCamera={session.config.cameraEnabled ? room.toggleCamera : undefined}
            onToggleScreen={session.config.screenShareEnabled ? room.toggleScreenShare : undefined}
            onToggleRaiseHand={room.toggleRaiseHand}
            onToggleReactions={() => setReactionsOpen((p) => !p)}
            onSendReaction={handleSendReaction}
            onToggleTimerPicker={() => setTimerPickerOpen((p) => !p)}
            onStartTimer={handleStartTimer}
            onStopTimer={room.stopTimer}
            onLeave={room.handleLeave}
            onEndMeeting={room.handleEndMeeting}
        />
    );
}

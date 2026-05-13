import { useState } from "react";
import {
    IconMic, IconMicOff,
    IconVideo, IconVideoOff,
    IconScreen, IconChat,
    IconUsers, IconHand, IconPhone, IconMore, IconTimer, IconChart,
} from "./Icons";

const REACTION_EMOJIS = {
    confetti: "🎉",
    clap:     "👏",
    laugh:    "😂",
    heart:    "❤️",
    fire:     "🔥",
    thumbsup: "👍",
};

const TIMER_PRESETS_MIN = [5, 15, 25, 45];

export default function ControlBar({
    isMuted, isCamOff, isScreenSharing,
    chatOpen, unreadCount, participantsOpen, statsOpen,
    myHandRaised, reactionsOpen, timerState, timerPickerOpen,
    isCreator,
    onToggleMute, onToggleCamera, onToggleScreen,
    onToggleChat, onToggleParticipants, onToggleStats,
    onToggleRaiseHand, onToggleReactions, onSendReaction,
    onToggleTimerPicker, onStartTimer, onStopTimer,
    onLeave, onEndMeeting,
}) {
    const [moreOpen, setMoreOpen] = useState(false);

    const cameraEnabled = typeof onToggleCamera === "function";
    const screenEnabled = typeof onToggleScreen === "function";
    const chatEnabled = typeof onToggleChat === "function";
    const timerEnabled = isCreator && typeof onToggleTimerPicker === "function";

    const hasSecondaryActions =
        typeof onToggleParticipants === "function" ||
        typeof onToggleStats === "function" ||
        typeof onToggleRaiseHand === "function" ||
        typeof onToggleReactions === "function" ||
        timerEnabled;

    const handleSecondary = (action) => {
        action?.();
    };

    return (
        <footer className="room-controls">
            <div className="control-cluster control-cluster-primary">
                <button
                    className={`ctrl-btn ${isMuted ? "muted" : ""}`}
                    onClick={onToggleMute}
                    title={isMuted ? "Unmute" : "Mute"}
                    id="btn-toggle-mute"
                >
                    {isMuted ? <IconMicOff /> : <IconMic />}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                </button>

                {cameraEnabled && (
                    <button
                        className={`ctrl-btn ${isCamOff ? "active" : ""}`}
                        onClick={onToggleCamera}
                        title={isCamOff ? "Turn camera on" : "Turn camera off"}
                        id="btn-toggle-camera"
                    >
                        {isCamOff ? <IconVideoOff /> : <IconVideo />}
                        <span>{isCamOff ? "Cam On" : "Cam Off"}</span>
                    </button>
                )}

                {screenEnabled && (
                    <button
                        className={`ctrl-btn ${isScreenSharing ? "active" : ""}`}
                        onClick={onToggleScreen}
                        title={isScreenSharing ? "Stop sharing" : "Share screen"}
                        id="btn-toggle-screen"
                    >
                        <IconScreen />
                        <span>{isScreenSharing ? "Stop" : "Share"}</span>
                    </button>
                )}

                {chatEnabled && (
                    <button
                        className={`ctrl-btn ${chatOpen ? "active" : ""}`}
                        onClick={onToggleChat}
                        title="Toggle chat"
                        id="btn-toggle-chat"
                    >
                        <IconChat />
                        <span>Chat</span>
                        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
                    </button>
                )}
            </div>

            {hasSecondaryActions && (
                <div className="more-controls">
                    <button
                        className={`ctrl-btn compact ${moreOpen ? "active" : ""}`}
                        onClick={() => setMoreOpen((open) => !open)}
                        title="More meeting tools"
                        id="btn-more-tools"
                        aria-expanded={moreOpen}
                    >
                        <IconMore />
                        <span>More</span>
                    </button>

                    {moreOpen && (
                        <div className="more-menu" role="menu" aria-label="Meeting tools">
                            {typeof onToggleParticipants === "function" && (
                                <button
                                    className={`more-menu-item ${participantsOpen ? "active" : ""}`}
                                    onClick={() => handleSecondary(onToggleParticipants)}
                                    role="menuitem"
                                >
                                    <IconUsers />
                                    <span>People</span>
                                </button>
                            )}

                            {typeof onToggleStats === "function" && (
                                <button
                                    className={`more-menu-item ${statsOpen ? "active" : ""}`}
                                    onClick={() => handleSecondary(onToggleStats)}
                                    role="menuitem"
                                >
                                    <IconChart />
                                    <span>Speaking stats</span>
                                </button>
                            )}

                            {typeof onToggleRaiseHand === "function" && (
                                <button
                                    className={`more-menu-item ${myHandRaised ? "active" : ""}`}
                                    onClick={() => handleSecondary(onToggleRaiseHand)}
                                    role="menuitem"
                                >
                                    <IconHand />
                                    <span>{myHandRaised ? "Lower hand" : "Raise hand"}</span>
                                </button>
                            )}

                            {typeof onToggleReactions === "function" && (
                                <div className="more-menu-group">
                                    <button
                                        className={`more-menu-item ${reactionsOpen ? "active" : ""}`}
                                        onClick={() => handleSecondary(onToggleReactions)}
                                        role="menuitem"
                                    >
                                        <span className="more-emoji">🎉</span>
                                        <span>Reactions</span>
                                    </button>
                                    {reactionsOpen && (
                                        <div className="inline-reactions">
                                            {Object.entries(REACTION_EMOJIS).map(([key, emoji]) => (
                                                <button
                                                    key={key}
                                                    className="reaction-btn"
                                                    onClick={() => onSendReaction(key)}
                                                    title={key}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {timerEnabled && (
                                <div className="more-menu-group">
                                    <button
                                        className={`more-menu-item ${timerState ? "active" : ""}`}
                                        onClick={() => timerState ? onStopTimer() : onToggleTimerPicker()}
                                        role="menuitem"
                                    >
                                        <IconTimer />
                                        <span>{timerState ? "Stop focus timer" : "Focus timer"}</span>
                                    </button>
                                    {timerPickerOpen && !timerState && (
                                        <div className="inline-timer-picker">
                                            {TIMER_PRESETS_MIN.map((min) => (
                                                <button
                                                    key={min}
                                                    className="timer-preset-btn"
                                                    onClick={() => onStartTimer(min * 60 * 1000)}
                                                >
                                                    {min}m
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="control-cluster control-cluster-end">
                {isCreator ? (
                    <button
                        className="ctrl-btn end-meeting"
                        onClick={onEndMeeting}
                        title="End meeting for everyone"
                        id="btn-end-meeting"
                    >
                        <IconPhone />
                        <span>End</span>
                    </button>
                ) : (
                    <button
                        className="ctrl-btn leave"
                        onClick={onLeave}
                        title="Leave meeting"
                        id="btn-leave"
                    >
                        <IconPhone />
                        <span>Leave</span>
                    </button>
                )}
            </div>
        </footer>
    );
}

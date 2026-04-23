import {
    IconMic, IconMicOff,
    IconVideo, IconVideoOff,
    IconScreen, IconChat,
    IconUsers, IconHand, IconPhone,
} from "./Icons";

const REACTION_EMOJIS = {
    confetti: "🎉",
    clap:     "👏",
    laugh:    "😂",
    heart:    "❤️",
    fire:     "🔥",
    thumbsup: "👍",
};

// Focus timer presets in minutes
const TIMER_PRESETS_MIN = [5, 15, 25, 45];

/**
 * ControlBar — bottom footer with all meeting action buttons.
 *
 * Props:
 *   isMuted          {boolean}
 *   isCamOff         {boolean}
 *   isScreenSharing  {boolean}
 *   chatOpen         {boolean}
 *   unreadCount      {number}
 *   participantsOpen {boolean}
 *   statsOpen        {boolean}
 *   myHandRaised     {boolean}
 *   reactionsOpen    {boolean}
 *   timerState       {object|null}
 *   timerPickerOpen  {boolean}
 *   isCreator        {boolean}
 *   onToggleMute           {() => void}
 *   onToggleCamera         {() => void}
 *   onToggleScreen         {() => void}
 *   onToggleChat           {() => void}
 *   onToggleParticipants   {() => void}
 *   onToggleStats          {() => void}
 *   onToggleRaiseHand      {() => void}
 *   onToggleReactions      {() => void}
 *   onSendReaction         {(type: string) => void}
 *   onToggleTimerPicker    {() => void}
 *   onStartTimer           {(durationMs: number) => void}
 *   onStopTimer            {() => void}
 *   onLeave                {() => void}
 *   onEndMeeting           {() => void}
 */
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
    return (
        <footer className="room-controls">
            {/* ── Media controls ─────────────────────────────────── */}
            <button
                className={`ctrl-btn ${isMuted ? "muted" : ""}`}
                onClick={onToggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                id="btn-toggle-mute"
            >
                {isMuted ? <IconMicOff /> : <IconMic />}
                <span>{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            <button
                className={`ctrl-btn ${isCamOff ? "active" : ""}`}
                onClick={onToggleCamera}
                title={isCamOff ? "Turn camera on" : "Turn camera off"}
                id="btn-toggle-camera"
            >
                {isCamOff ? <IconVideoOff /> : <IconVideo />}
                <span>{isCamOff ? "Cam On" : "Cam Off"}</span>
            </button>

            <button
                className={`ctrl-btn ${isScreenSharing ? "active" : ""}`}
                onClick={onToggleScreen}
                title={isScreenSharing ? "Stop sharing" : "Share screen"}
                id="btn-toggle-screen"
            >
                <IconScreen />
                <span>{isScreenSharing ? "Stop" : "Share"}</span>
            </button>

            <div className="controls-divider" />

            {/* ── Panel toggles ───────────────────────────────────── */}
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

            <button
                className={`ctrl-btn ${participantsOpen ? "active" : ""}`}
                onClick={onToggleParticipants}
                title="Participants"
                id="btn-toggle-participants"
            >
                <IconUsers />
                <span>People</span>
            </button>

            <button
                className={`ctrl-btn ${statsOpen ? "active" : ""}`}
                onClick={onToggleStats}
                title="Speaking Stats"
                id="btn-toggle-stats"
            >
                <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>📊</span>
                <span>Stats</span>
            </button>

            <button
                className={`ctrl-btn ${myHandRaised ? "active" : ""}`}
                onClick={onToggleRaiseHand}
                title={myHandRaised ? "Lower hand" : "Raise hand"}
                id="btn-raise-hand"
            >
                <IconHand />
                <span>{myHandRaised ? "Lower" : "Raise"}</span>
            </button>

            {/* ── Reactions picker ────────────────────────────────── */}
            <div className="reactions-wrapper">
                <button
                    className={`ctrl-btn ${reactionsOpen ? "active" : ""}`}
                    onClick={onToggleReactions}
                    title="Reactions"
                    id="btn-reactions"
                >
                    <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>🎉</span>
                    <span>React</span>
                </button>
                {reactionsOpen && (
                    <div className="reactions-picker">
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

            {/* ── Focus timer (creator only) ───────────────────────── */}
            {isCreator && (
                <div className="reactions-wrapper">
                    <button
                        className={`ctrl-btn ${timerState ? "active" : ""}`}
                        onClick={() => timerState ? onStopTimer() : onToggleTimerPicker()}
                        title={timerState ? "Stop timer" : "Start focus timer"}
                        id="btn-focus-timer"
                    >
                        <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>⏱️</span>
                        <span>{timerState ? "Stop" : "Focus"}</span>
                    </button>
                    {timerPickerOpen && !timerState && (
                        <div className="timer-picker">
                            <div className="timer-picker-title">Focus Timer</div>
                            {TIMER_PRESETS_MIN.map((min) => (
                                <button
                                    key={min}
                                    className="timer-preset-btn"
                                    onClick={() => onStartTimer(min * 60 * 1000)}
                                >
                                    {min} min
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="controls-divider" />

            {/* ── Leave / End ─────────────────────────────────────── */}
            {isCreator ? (
                <button
                    className="ctrl-btn end-meeting"
                    onClick={onEndMeeting}
                    title="End meeting for everyone"
                    id="btn-end-meeting"
                >
                    <IconPhone />
                    <span>End&nbsp;Meeting</span>
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
        </footer>
    );
}

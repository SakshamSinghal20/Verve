/**
 * TimerBar — full-width progress bar shown at the top of the room when a focus
 * timer is active.
 *
 * Props:
 *   timerState     {{ durationMs: number, startedAt: number } | null}
 *   timerRemaining {number | null}  countdown in seconds
 *   isCreator      {boolean}
 *   onStop         {() => void}
 */

/** Zero-pads a number to two digits. */
function pad(n) {
    return String(n).padStart(2, "0");
}

/** Formats a second count as "MM:SS". */
export function formatTimerDisplay(seconds) {
    if (seconds == null || seconds < 0) return "00:00";
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export default function TimerBar({ timerState, timerRemaining, isCreator, onStop }) {
    if (!timerState || timerRemaining == null) return null;

    const progressPct = Math.max(
        0,
        (timerRemaining / (timerState.durationMs / 1000)) * 100
    );

    return (
        <div className="timer-bar">
            <div className="timer-bar-progress" style={{ width: `${progressPct}%` }} />
            <div className="timer-bar-content">
                <span className="timer-bar-icon">⏱️</span>
                <span className="timer-bar-label">Focus Mode</span>
                <span className="timer-bar-time">{formatTimerDisplay(timerRemaining)}</span>
                {isCreator && (
                    <button className="timer-stop-btn" onClick={onStop}>Stop</button>
                )}
            </div>
        </div>
    );
}

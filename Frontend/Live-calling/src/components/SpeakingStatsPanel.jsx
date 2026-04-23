/** Formats milliseconds into a human-readable speaking duration (e.g. "2m 14s"). */
export function formatSpeakingTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * SpeakingStatsPanel — slide-in panel showing per-user cumulative speaking time.
 *
 * Props:
 *   isOpen        {boolean}
 *   onClose       {() => void}
 *   speakingStats {Object}  userId → { ms, name }
 *   peersList     {Array<{peerId, userId, name}>}
 *   peerInfo      {Object}  socketId → { userId, name }
 *   myUserId      {string|null}
 */
export default function SpeakingStatsPanel({ isOpen, onClose, speakingStats, peersList, peerInfo, myUserId }) {
    const entries = Object.entries(speakingStats);
    const maxMs   = Math.max(...entries.map(([, v]) => v.ms), 1);

    return (
        <div className={`stats-panel ${isOpen ? "open" : ""}`}>
            <div className="chat-header">
                <span>📊 Speaking Stats</span>
                <button className="chat-close" onClick={onClose}>×</button>
            </div>

            <div className="stats-list">
                {entries.length === 0 ? (
                    <p className="chat-empty">No speaking data yet.<br/>Start talking to see stats!</p>
                ) : (
                    entries
                        .sort((a, b) => b[1].ms - a[1].ms)
                        .map(([uid, { ms, name }]) => {
                            const pct  = Math.round((ms / maxMs) * 100);
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
                        })
                )}

                {/* Peers who haven't spoken yet */}
                {peersList
                    .filter((p) => !speakingStats[p.userId || p.peerId])
                    .map((p) => {
                        const nm = p.name || peerInfo[p.peerId]?.name || "Unknown";
                        return (
                            <div key={p.peerId} className="stats-row">
                                <div className="stats-label">
                                    <span className="stats-name stats-quiet">{nm}</span>
                                    <span className="stats-time stats-quiet">Hasn't spoken</span>
                                </div>
                                <div className="stats-bar">
                                    <div className="stats-bar-fill" style={{ width: "0%" }} />
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}

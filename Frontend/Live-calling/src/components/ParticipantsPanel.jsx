import { peerColor } from "../utils/peerColor";

/**
 * ParticipantsPanel — slide-in panel listing all peers currently in the room.
 *
 * Props:
 *   isOpen    {boolean}
 *   onClose   {() => void}
 *   peersList {Array<{peerId, userId, name}>}
 *   peerInfo  {Object}  socketId → { userId, name }
 *   myUserId  {string|null}
 */
export default function ParticipantsPanel({ isOpen, onClose, peersList, peerInfo, myUserId }) {
    return (
        <div className={`participants-panel ${isOpen ? "open" : ""}`}>
            <div className="chat-header">
                <span>People ({peersList.length})</span>
                <button className="chat-close" onClick={onClose}>✕</button>
            </div>

            <div className="participants-list">
                {peersList.map((peerEntry) => {
                    const pid  = peerEntry?.peerId || peerEntry;
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
    );
}

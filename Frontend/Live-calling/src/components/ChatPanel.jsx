import { useRef } from "react";
import { IconSend } from "./Icons";

/**
 * ChatPanel — slide-in side panel showing chat history and message input.
 *
 * Props:
 *   isOpen        {boolean}
 *   onClose       {() => void}
 *   messages      {Array<{peerId, userId, name, message, timestamp}>}
 *   chatInput     {string}
 *   onInputChange {(value: string) => void}
 *   onSend        {() => void}
 *   myUserId      {string|null}
 *   mySocketId    {string|null}
 *   peerInfo      {Object}  socketId → { userId, name }
 */
export default function ChatPanel({
    isOpen,
    onClose,
    messages,
    chatInput,
    onInputChange,
    onSend,
    myUserId,
    mySocketId,
    peerInfo,
}) {
    const chatEndRef = useRef(null);

    // Auto-scroll to bottom whenever messages change
    // (the parent renders this unconditionally so useEffect runs correctly)
    const scrollRef = (el) => {
        if (el) el.scrollIntoView({ behavior: "smooth" });
    };

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    }

    return (
        <div className={`chat-panel ${isOpen ? "open" : ""}`}>
            <div className="chat-header">
                <span>Chat</span>
                <button className="chat-close" onClick={onClose}>✕</button>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <p className="chat-empty">No messages yet.<br />Say hi! 👋</p>
                )}
                {messages.map((msg, i) => {
                    // Self-detect via userId — correct even across multiple tabs
                    const isSelf = msg.userId
                        ? msg.userId === myUserId
                        : msg.peerId === mySocketId;
                    const senderName = isSelf
                        ? "You"
                        : (msg.name || peerInfo[msg.peerId]?.name || `Peer ${(msg.peerId || "").slice(0, 6)}`);
                    return (
                        <div key={i} className={`chat-bubble ${isSelf ? "self" : ""}`}>
                            <span className="chat-sender">{senderName}</span>
                            <p className="chat-text">{msg.message}</p>
                            <span className="chat-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                    );
                })}
                {/* Invisible anchor — scrolled into view on new messages */}
                <div ref={scrollRef} />
            </div>

            <div className="chat-input-group">
                <input
                    type="text"
                    placeholder="Type a message…"
                    value={chatInput}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    id="chat-input"
                />
                <button
                    className="chat-send-btn"
                    onClick={onSend}
                    disabled={!chatInput.trim()}
                >
                    <IconSend />
                </button>
            </div>
        </div>
    );
}

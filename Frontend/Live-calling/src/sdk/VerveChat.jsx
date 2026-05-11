/**
 * VerveChat — Prebuilt chat panel for SDK consumers.
 *
 * Wraps the existing ChatPanel component with SDK session integration.
 *
 * Usage:
 *   <VerveProvider session={session}>
 *     <VerveChat room={room} />
 *   </VerveProvider>
 */

import React, { useState } from "react";
import { useVerveSession } from "./VerveProvider";
import ChatPanel from "../components/ChatPanel";

/**
 * @param {Object} props
 * @param {Object} props.room    — return value of useRoomSocket()
 * @param {boolean} [props.isOpen=true] — whether the panel is visible
 * @param {Function} [props.onClose]    — close handler
 */
export default function VerveChat({ room, isOpen = true, onClose }) {
    const session = useVerveSession();
    const [chatInput, setChatInput] = useState("");

    if (!session.config.chatEnabled) return null;

    function handleSend() {
        room.sendChatMessage(chatInput);
        setChatInput("");
    }

    return (
        <ChatPanel
            isOpen={isOpen}
            onClose={onClose || (() => {})}
            messages={room.chatMessages}
            chatInput={chatInput}
            onInputChange={setChatInput}
            onSend={handleSend}
            myUserId={room.myUserId}
            mySocketId={room.socketRef.current?.id}
            peerInfo={room.peerInfo}
        />
    );
}

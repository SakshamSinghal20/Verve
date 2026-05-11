/**
 * VerveParticipants — Prebuilt participants panel for SDK consumers.
 *
 * Wraps the existing ParticipantsPanel component.
 *
 * Usage:
 *   <VerveProvider session={session}>
 *     <VerveParticipants room={room} />
 *   </VerveProvider>
 */

import React from "react";
import ParticipantsPanel from "../components/ParticipantsPanel";

/**
 * @param {Object} props
 * @param {Object}   props.room     — return value of useRoomSocket()
 * @param {boolean}  [props.isOpen=true]
 * @param {Function} [props.onClose]
 */
export default function VerveParticipants({ room, isOpen = true, onClose }) {
    return (
        <ParticipantsPanel
            isOpen={isOpen}
            onClose={onClose || (() => {})}
            peersList={room.peersList}
            peerInfo={room.peerInfo}
            myUserId={room.myUserId}
        />
    );
}

import React, { useEffect, useRef } from "react";
import { IconPin } from "./Icons";
import { peerColor } from "../utils/peerColor";

/**
 * RemoteVideo — renders a single remote peer's video stream with name label,
 * camera-off avatar, hand-raise badge, and pin/unpin button.
 */
export function RemoteVideo({ peerId, peerName, stream, handRaised, isPinned, onPin, onUnpin, isThumbnail }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const hasVideo   = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
    const displayName = peerName || `Peer ${peerId.slice(0, 6)}`;

    return (
        <div className={`video-card remote ${isPinned ? "pinned-card" : ""} ${isThumbnail ? "thumbnail-card" : ""}`}>
            <video ref={videoRef} autoPlay playsInline />
            {!hasVideo && (
                <div className="cam-off-overlay">
                    <div className="cam-off-avatar" style={{ background: peerColor(peerId) }}>
                        {displayName.slice(0, 1).toUpperCase()}
                    </div>
                    {!isThumbnail && <p>{displayName}</p>}
                </div>
            )}
            <div className="video-label">{displayName}</div>
            {handRaised && <div className="hand-badge">✋</div>}
            {isPinned ? (
                <button className="pin-btn pin-btn--active" onClick={onUnpin} title="Unpin" aria-label="Unpin user">
                    <IconPin filled />
                    <span>Pinned</span>
                </button>
            ) : (
                <button className="pin-btn" onClick={() => onPin(peerId)} title="Pin to full screen" aria-label="Pin user to full screen">
                    <IconPin />
                    <span>Pin</span>
                </button>
            )}
        </div>
    );
}

/**
 * VideoGrid — renders all video tiles (local, local screen share, remote webcams,
 * remote screen shares) in either pinned or grid layout.
 *
 * Props:
 *   localVideoRef      {React.Ref}
 *   localScreenStream  {MediaStream | null}
 *   remoteStreams       {Object}  peerId → { webcam, screen }
 *   peerInfo           {Object}  socketId → { userId, name }
 *   raisedHands        {Object}  userId → true
 *   pinnedInfo         {{ peerId, streamType } | null}
 *   isCamOff           {boolean}
 *   isScreenSharing    {boolean}
 *   myHandRaised       {boolean}
 *   myUserId           {string | null}
 *   userName           {string | undefined}
 *   onPin              {(peerId, streamType) => void}
 *   onUnpin            {() => void}
 */
export default function VideoGrid({
    localVideoRef,
    localScreenStream,
    remoteStreams,
    peerInfo,
    raisedHands,
    pinnedInfo,
    isCamOff,
    isScreenSharing,
    myHandRaised,
    myUserId,
    userName,
    onPin,
    onUnpin,
}) {
    // Compute grid class based on total tile count
    const remoteScreenCount = Object.values(remoteStreams).filter(
        (s) => s.screen?.getVideoTracks().some((t) => t.readyState === "live")
    ).length;
    const totalParticipants =
        1 +
        Object.keys(remoteStreams).length +
        (localScreenStream ? 1 : 0) +
        remoteScreenCount;

    const gridClass =
        totalParticipants <= 1 ? "grid-1"
        : totalParticipants <= 2 ? "grid-2"
        : totalParticipants <= 4 ? "grid-4"
        : "grid-many";

    // ── Pinned layout ──────────────────────────────────────────────────────
    if (pinnedInfo) {
        const { peerId: pinnedPeerId, streamType } = pinnedInfo;

        let pinnedStream, pinnedName, pinnedHandKey;
        if (streamType === "local-screen") {
            pinnedStream  = localScreenStream;
            pinnedName    = "Your Screen";
            pinnedHandKey = null;
        } else {
            const peerStreams = remoteStreams[pinnedPeerId];
            pinnedStream     = streamType === "screen" ? peerStreams?.screen : peerStreams?.webcam;
            const info       = peerInfo[pinnedPeerId];
            pinnedHandKey    = info?.userId || pinnedPeerId;
            const baseName   = info?.name || `Peer ${pinnedPeerId.slice(0, 6)}`;
            pinnedName       = streamType === "screen" ? `${baseName}'s Screen` : baseName;
        }

        return (
            <main className="video-stage pinned-layout">
                <div className="pinned-main">
                    {streamType === "local-screen" ? (
                        <div className="video-card pinned-card">
                            <video
                                ref={(el) => { if (el) el.srcObject = localScreenStream; }}
                                autoPlay playsInline muted
                            />
                            <div className="video-label">Your Screen</div>
                        </div>
                    ) : (
                        <RemoteVideo
                            peerId={pinnedPeerId}
                            peerName={pinnedName}
                            stream={pinnedStream}
                            handRaised={!!raisedHands[pinnedHandKey]}
                            isPinned
                            onPin={onPin}
                            onUnpin={onUnpin}
                        />
                    )}
                    <div className="pinned-banner">
                        <IconPin filled />
                        <span>{pinnedName} — Pinned</span>
                        <button className="pinned-banner-unpin" onClick={onUnpin}>✕ Unpin</button>
                    </div>
                </div>
            </main>
        );
    }

    // ── Default grid layout ────────────────────────────────────────────────
    return (
        <main className={`video-stage ${gridClass}`}>
            {/* Local webcam tile */}
            <div className="video-card local">
                <video
                    ref={localVideoRef}
                    autoPlay playsInline muted
                    className={isCamOff ? "cam-off" : ""}
                />
                {isCamOff && (
                    <div className="cam-off-overlay">
                        <div className="cam-off-avatar">{(userName || "Y").slice(0, 1).toUpperCase()}</div>
                        <p>Camera Off</p>
                    </div>
                )}
                {isScreenSharing && <div className="screen-share-badge">Sharing screen</div>}
                <div className="video-label">You {userName ? `(${userName})` : ""}</div>
                {myHandRaised && <div className="hand-badge">✋</div>}
            </div>

            {/* Local screen share tile */}
            {localScreenStream && (
                <div className="video-card local screen-share">
                    <video
                        ref={(el) => { if (el) el.srcObject = localScreenStream; }}
                        autoPlay playsInline muted
                    />
                    <div className="video-label">Your Screen</div>
                    <button
                        className="pin-btn"
                        onClick={() => onPin("local-screen", "local-screen")}
                        title="Pin to full screen"
                        aria-label="Pin your screen share"
                    >
                        <IconPin />
                        <span>Pin</span>
                    </button>
                </div>
            )}

            {/* Remote peers */}
            {Object.entries(remoteStreams).map(([peerId, streams]) => {
                const info         = peerInfo[peerId];
                const resolvedName = info?.name || `Peer ${peerId.slice(0, 6)}`;
                const isSameUser   = info?.userId && info.userId === myUserId;
                const displayName  = isSameUser ? `${resolvedName} (other tab)` : resolvedName;
                const handKey      = info?.userId || peerId;

                return (
                    <React.Fragment key={peerId}>
                        <RemoteVideo
                            peerId={peerId}
                            peerName={displayName}
                            stream={streams.webcam}
                            handRaised={!!raisedHands[handKey]}
                            isPinned={pinnedInfo?.peerId === peerId && pinnedInfo?.streamType === "webcam"}
                            onPin={(pid) => onPin(pid, "webcam")}
                            onUnpin={onUnpin}
                        />
                        {streams.screen?.getVideoTracks().some((t) => t.readyState === "live") && (
                            <RemoteVideo
                                peerId={peerId}
                                peerName={`${displayName}'s Screen`}
                                stream={streams.screen}
                                handRaised={false}
                                isPinned={pinnedInfo?.peerId === peerId && pinnedInfo?.streamType === "screen"}
                                onPin={(pid) => onPin(pid, "screen")}
                                onUnpin={onUnpin}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </main>
    );
}

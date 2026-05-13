import { IconHand, IconScreen, IconTimer, IconChart, IconUsers } from "./Icons";

function formatTimer(seconds) {
    if (seconds == null) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getTopSpeaker(speakingStats) {
    const entries = Object.values(speakingStats || {});
    if (!entries.length) return null;
    return entries.reduce((best, item) => {
        if (!best || (item?.ms || 0) > (best?.ms || 0)) return item;
        return best;
    }, null);
}

export default function RoomPulse({
    totalParticipants,
    raisedHands,
    speakingStats,
    timerState,
    timerRemaining,
    isScreenSharing,
    pinnedInfo,
}) {
    const handCount = Object.keys(raisedHands || {}).length;
    const timerText = timerState ? formatTimer(timerRemaining) : null;
    const topSpeaker = getTopSpeaker(speakingStats);

    const items = [
        totalParticipants > 1 && {
            key: "people",
            icon: <IconUsers />,
            label: `${totalParticipants} live`,
            active: totalParticipants > 1,
        },
        timerText && {
            key: "timer",
            icon: <IconTimer />,
            label: `Focus ${timerText}`,
            active: true,
        },
        handCount > 0 && {
            key: "hands",
            icon: <IconHand />,
            label: `${handCount} hand${handCount === 1 ? "" : "s"} raised`,
            active: true,
        },
        isScreenSharing && {
            key: "screen",
            icon: <IconScreen />,
            label: "Screen live",
            active: true,
        },
        pinnedInfo && {
            key: "pin",
            icon: <IconScreen />,
            label: "Focus view",
            active: true,
        },
        topSpeaker?.ms > 0 && {
            key: "speaker",
            icon: <IconChart />,
            label: `${topSpeaker.name || "Speaker"} leading`,
            active: false,
        },
    ].filter(Boolean).slice(0, 4);

    if (!items.length) return null;

    return (
        <div className="room-pulse" aria-label="Room pulse">
            {items.map((item) => (
                <div key={item.key} className={`room-pulse-item ${item.active ? "active" : ""}`}>
                    {item.icon}
                    <span>{item.label}</span>
                </div>
            ))}
        </div>
    );
}

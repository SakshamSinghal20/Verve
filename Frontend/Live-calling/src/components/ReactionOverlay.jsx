const REACTION_EMOJIS = {
    confetti: "🎉",
    clap:     "👏",
    laugh:    "😂",
    heart:    "❤️",
    fire:     "🔥",
    thumbsup: "👍",
};

/**
 * ReactionOverlay — full-viewport layer that floats emoji reactions upward.
 *
 * Props:
 *   reactions {Array<{id, type, name, left}>}
 */
export default function ReactionOverlay({ reactions }) {
    return (
        <div className="reactions-overlay" aria-hidden="true">
            {reactions.map((r) => (
                <div
                    key={r.id}
                    className="reaction-float"
                    style={{ left: `${r.left}%` }}
                >
                    <span className="reaction-float-emoji">{REACTION_EMOJIS[r.type]}</span>
                    <span className="reaction-float-name">{r.name}</span>
                </div>
            ))}
        </div>
    );
}

/** Returns a deterministic color for a given peer ID string. */
export function peerColor(peerId) {
    const colors = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];
    let hash = 0;
    for (const c of peerId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
}

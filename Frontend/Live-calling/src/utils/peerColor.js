/** Returns a deterministic color for a given peer ID string. */
export function peerColor(peerId) {
    const colors = ["#FF3366", "#F72560", "#FF7096", "#FFD166", "#FFB703", "#E85D75", "#FF3366"];
    let hash = 0;
    for (const c of peerId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
}

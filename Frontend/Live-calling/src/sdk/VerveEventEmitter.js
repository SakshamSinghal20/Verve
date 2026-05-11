/**
 * VerveEventEmitter — Lightweight namespaced event system for the SDK.
 *
 * Supports events like:
 *   participant.joined, participant.left,
 *   chat.message,
 *   mic.changed, camera.changed,
 *   screenShare.started, screenShare.stopped,
 *   room.connected, room.disconnected, room.ended
 *
 * Usage:
 *   emitter.on("participant.joined", (data) => { ... });
 *   emitter.off("participant.joined", handler);
 *   emitter.emit("participant.joined", { id, name });
 */

export class VerveEventEmitter {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
    }

    /**
     * Subscribe to a namespaced event.
     * @param {string} event — e.g. "participant.joined"
     * @param {Function} fn
     * @returns {() => void} unsubscribe function
     */
    on(event, fn) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(fn);
        return () => this.off(event, fn);
    }

    /**
     * Unsubscribe from a namespaced event.
     * @param {string} event
     * @param {Function} fn
     */
    off(event, fn) {
        this._listeners.get(event)?.delete(fn);
    }

    /**
     * Emit a namespaced event to all subscribers.
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
        this._listeners.get(event)?.forEach((fn) => {
            try {
                fn(data);
            } catch (err) {
                console.error(`[Verve] Event handler error (${event}):`, err);
            }
        });
    }

    /** Remove all listeners (used during destroy). */
    removeAll() {
        this._listeners.clear();
    }
}

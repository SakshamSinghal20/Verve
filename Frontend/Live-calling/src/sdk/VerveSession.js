/**
 * VerveSession — Bridges the developer-facing SDK to the existing meeting stack.
 *
 * Architecture (constraint 9):
 *   Existing RTC Core (Mediasoup/Socket.IO)
 *       ↓
 *   Existing Room Logic (useRoomSocket hook)
 *       ↓
 *   SDK Abstraction Layer (this file)
 *
 * This is a framework-agnostic vanilla JS class (constraint 5).
 * React components live in a separate layer and consume this via context.
 *
 * State management strategy (constraint 2):
 *   - In HEADLESS mode (no React): session maintains lightweight derived state
 *     from socket events — it's the only consumer, so no duplication.
 *   - In COMPONENT mode (VerveRoom): useRoomSocket is the authoritative source;
 *     session only handles config, events, and lifecycle — no state duplication.
 *
 * Connection lifecycle (constraint 7):
 *   idle → connecting → connected → reconnecting → disconnected → destroyed
 */

import { createSocket } from "../socket";
import { VerveEventEmitter } from "./VerveEventEmitter";

// ── Connection States (constraint 7) ────────────────────────────────────────

export const ConnectionState = Object.freeze({
    IDLE:          "idle",
    CONNECTING:    "connecting",
    CONNECTED:     "connected",
    RECONNECTING:  "reconnecting",
    DISCONNECTED:  "disconnected",
    DESTROYED:     "destroyed",
});

// ── Stable event names (constraint 8) ───────────────────────────────────────
// These are the SDK's public event contract. Internal socket events are
// translated through _emitSdkEvent() so backend changes don't break consumers.

export const SdkEvent = Object.freeze({
    ROOM_CONNECTED:       "room.connected",
    ROOM_DISCONNECTED:    "room.disconnected",
    ROOM_ENDED:           "room.ended",
    ROOM_STATE_CHANGED:   "room.stateChanged",
    PARTICIPANT_JOINED:   "participant.joined",
    PARTICIPANT_LEFT:     "participant.left",
    PARTICIPANT_HAND_RAISED:  "participant.handRaised",
    PARTICIPANT_HAND_LOWERED: "participant.handLowered",
    CHAT_MESSAGE:         "chat.message",
    MIC_CHANGED:          "mic.changed",
    CAMERA_CHANGED:       "camera.changed",
    SCREEN_SHARE_STARTED: "screenShare.started",
    SCREEN_SHARE_STOPPED: "screenShare.stopped",
    REACTION:             "reaction",
});

export class VerveSession extends VerveEventEmitter {
    /**
     * @param {Object} opts — created by Verve.init()
     */
    constructor(opts) {
        super();

        // ── Configuration (immutable after init) ────────────────────────
        this._token     = opts.token;
        this._roomId    = opts.roomId;
        this._guestId   = opts.guestId;
        this._guestName = opts.guestName;
        this._role      = opts.role;
        this._serverUrl = opts.serverUrl;
        this._config    = Object.freeze({ ...opts.config });
        this._theme     = Object.freeze({ ...opts.theme });
        this._apiKey    = opts.apiKey;

        // ── Connection state machine (constraint 7) ─────────────────────
        this._connectionState = ConnectionState.IDLE;

        // ── Socket reference ────────────────────────────────────────────
        /** @type {import("socket.io-client").Socket | null} */
        this._socket = null;

        // ── Component mode flag (constraint 2) ──────────────────────────
        // When true, VerveRoom's useRoomSocket is the authoritative state
        // source — this session only handles config + event forwarding.
        this._componentMode = false;

        // ── Bound listener references for cleanup (constraint 3) ────────
        this._boundListeners = [];
    }

    // ── Public Getters ─────────────────────────────────────────────────────

    get roomId()          { return this._roomId; }
    get guestId()         { return this._guestId; }
    get guestName()       { return this._guestName; }
    get role()            { return this._role; }
    get config()          { return this._config; }
    get theme()           { return this._theme; }
    get connectionState() { return this._connectionState; }
    get connected()       { return this._connectionState === ConnectionState.CONNECTED; }
    get destroyed()       { return this._connectionState === ConnectionState.DESTROYED; }

    // ── Connection State Machine (constraint 7) ────────────────────────────

    /** @private */
    _transitionTo(newState) {
        const prev = this._connectionState;
        if (prev === newState) return;

        // Validate transitions
        const valid = {
            [ConnectionState.IDLE]:         [ConnectionState.CONNECTING, ConnectionState.DESTROYED],
            [ConnectionState.CONNECTING]:   [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.DESTROYED],
            [ConnectionState.CONNECTED]:    [ConnectionState.DISCONNECTED, ConnectionState.RECONNECTING, ConnectionState.DESTROYED],
            [ConnectionState.RECONNECTING]: [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.DESTROYED],
            [ConnectionState.DISCONNECTED]: [ConnectionState.CONNECTING, ConnectionState.DESTROYED],
            [ConnectionState.DESTROYED]:    [],  // terminal state
        };

        if (!valid[prev]?.includes(newState)) {
            console.warn(`[Verve] Invalid state transition: ${prev} → ${newState}`);
            return;
        }

        this._connectionState = newState;
        this._emitSdkEvent(SdkEvent.ROOM_STATE_CHANGED, { from: prev, to: newState });
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    /**
     * Join the room. Creates socket and connects (constraint 4:
     * socket creation happens here, NOT during init).
     * @returns {Promise<{ isCreator: boolean }>}
     */
    async joinRoom() {
        this._assertNotDestroyed();

        if (this._connectionState === ConnectionState.CONNECTED) {
            throw new Error("[Verve] Already connected to the room");
        }
        if (this._connectionState === ConnectionState.CONNECTING) {
            throw new Error("[Verve] Connection already in progress");
        }

        this._transitionTo(ConnectionState.CONNECTING);

        return new Promise((resolve, reject) => {
            // Socket created only at join time (constraint 4)
            this._socket = createSocket(this._token);
            this._bindSocketEvents();
            this._socket.connect();

            this._socket.emit("join-room", this._roomId, (response) => {
                if (response.error) {
                    this._transitionTo(ConnectionState.DISCONNECTED);
                    this._cleanupSocket();
                    return reject(new Error(`[Verve] Join failed: ${response.error}`));
                }

                this._transitionTo(ConnectionState.CONNECTED);
                this._emitSdkEvent(SdkEvent.ROOM_CONNECTED, {
                    roomId:    this._roomId,
                    isCreator: response.isCreator,
                });

                resolve({ isCreator: response.isCreator });
            });

            // Connection-level error before join callback
            const onConnectError = (err) => {
                if (this._connectionState === ConnectionState.CONNECTING) {
                    this._transitionTo(ConnectionState.DISCONNECTED);
                    this._cleanupSocket();
                    reject(new Error(`[Verve] Connection failed: ${err.message}`));
                }
            };
            this._socket.on("connect_error", onConnectError);
            this._boundListeners.push(["connect_error", onConnectError]);
        });
    }

    /**
     * Leave the room. Idempotent — safe to call multiple times (constraint 3).
     */
    leaveRoom() {
        if (this._connectionState === ConnectionState.DESTROYED) return;
        if (this._connectionState === ConnectionState.IDLE) return;
        if (this._connectionState === ConnectionState.DISCONNECTED) return;

        this._cleanupSocket();
        this._transitionTo(ConnectionState.DISCONNECTED);
        this._emitSdkEvent(SdkEvent.ROOM_DISCONNECTED, {
            roomId: this._roomId,
            reason: "leave",
        });
    }

    /**
     * Destroy session. Terminal state — cannot be reused (constraint 3).
     * Idempotent — safe to call multiple times.
     */
    destroy() {
        if (this._connectionState === ConnectionState.DESTROYED) return;

        this._cleanupSocket();
        this._transitionTo(ConnectionState.DESTROYED);
        this.removeAll(); // clear all event listeners
    }

    // ── Actions ────────────────────────────────────────────────────────────
    // These are only used in HEADLESS mode. In component mode,
    // useRoomSocket handles actions directly.

    toggleMic() {
        this._assertConnected();
        this._socket.emit("toggle-mute");
        this._emitSdkEvent(SdkEvent.MIC_CHANGED, {});
    }

    toggleCamera() {
        this._assertConnected();
        if (!this._config.cameraEnabled) {
            console.warn("[Verve] Camera is disabled by room config");
            return;
        }
        this._socket.emit("toggle-camera");
        this._emitSdkEvent(SdkEvent.CAMERA_CHANGED, {});
    }

    startScreenShare() {
        this._assertConnected();
        if (!this._config.screenShareEnabled) {
            console.warn("[Verve] Screen share is disabled by room config");
            return;
        }
        this._socket.emit("start-screen-share");
        this._emitSdkEvent(SdkEvent.SCREEN_SHARE_STARTED, {});
    }

    stopScreenShare() {
        this._assertConnected();
        this._socket.emit("stop-screen-share");
        this._emitSdkEvent(SdkEvent.SCREEN_SHARE_STOPPED, {});
    }

    sendMessage(text) {
        this._assertConnected();
        if (!this._config.chatEnabled) {
            console.warn("[Verve] Chat is disabled by room config");
            return;
        }
        if (!text || typeof text !== "string") return;
        this._socket.emit("chat-message", text.trim());
    }

    toggleRaiseHand() {
        this._assertConnected();
        this._socket.emit("toggle-raise-hand");
    }

    // ── Component Mode (constraint 2) ──────────────────────────────────────
    // Called by VerveRoom to signal that useRoomSocket is the state authority.

    /** @internal — used by VerveRoom, not by SDK consumers */
    _enterComponentMode() {
        this._componentMode = true;
    }

    // ── Stable Event Re-emission (constraint 8) ────────────────────────────
    // All SDK events go through this method so we can refactor internal
    // socket events without breaking the public event contract.

    /** @private */
    _emitSdkEvent(sdkEventName, data) {
        this.emit(sdkEventName, data);
    }

    // ── Internal Socket Management ─────────────────────────────────────────

    /** @private — bind socket events and translate to SDK events */
    _bindSocketEvents() {
        const s = this._socket;
        if (!s) return;

        const bind = (socketEvent, handler) => {
            s.on(socketEvent, handler);
            this._boundListeners.push([socketEvent, handler]);
        };

        // Participant tracking → SDK events
        bind("user-joined", ({ userId, name }) => {
            this._emitSdkEvent(SdkEvent.PARTICIPANT_JOINED, { id: userId, name });
        });

        bind("user-left", ({ userId, name }) => {
            this._emitSdkEvent(SdkEvent.PARTICIPANT_LEFT, { id: userId, name });
        });

        // Chat → SDK events
        bind("chat-message", (msg) => {
            this._emitSdkEvent(SdkEvent.CHAT_MESSAGE, msg);
        });

        // Room ended → SDK events
        bind("room-ended", () => {
            this._transitionTo(ConnectionState.DISCONNECTED);
            this._emitSdkEvent(SdkEvent.ROOM_ENDED, { roomId: this._roomId });
        });

        // Socket disconnect → SDK events
        bind("disconnect", (reason) => {
            if (this._connectionState === ConnectionState.CONNECTED) {
                // Distinguish intentional vs network disconnect
                if (reason === "io server disconnect" || reason === "io client disconnect") {
                    this._transitionTo(ConnectionState.DISCONNECTED);
                    this._emitSdkEvent(SdkEvent.ROOM_DISCONNECTED, {
                        roomId: this._roomId,
                        reason,
                    });
                } else {
                    this._transitionTo(ConnectionState.RECONNECTING);
                    this._emitSdkEvent(SdkEvent.ROOM_STATE_CHANGED, {
                        from: ConnectionState.CONNECTED,
                        to: ConnectionState.RECONNECTING,
                    });
                }
            }
        });

        // Socket reconnect
        bind("connect", () => {
            if (this._connectionState === ConnectionState.RECONNECTING) {
                this._transitionTo(ConnectionState.CONNECTED);
            }
        });

        // Hand raise/lower
        bind("hand-raised", ({ userId }) => {
            this._emitSdkEvent(SdkEvent.PARTICIPANT_HAND_RAISED, { id: userId });
        });

        bind("hand-lowered", ({ userId }) => {
            this._emitSdkEvent(SdkEvent.PARTICIPANT_HAND_LOWERED, { id: userId });
        });

        // Reactions
        bind("reaction", (data) => {
            this._emitSdkEvent(SdkEvent.REACTION, data);
        });
    }

    /**
     * Centralized socket cleanup (constraint 3).
     * Removes all bound listeners, disconnects socket, nulls reference.
     * Idempotent — safe to call multiple times.
     * @private
     */
    _cleanupSocket() {
        if (!this._socket) return;

        // Remove all bound listeners to prevent leaks
        this._boundListeners.forEach(([event, handler]) => {
            this._socket?.off(event, handler);
        });
        this._boundListeners = [];

        // Disconnect if still connected
        if (this._socket.connected) {
            this._socket.disconnect();
        }

        this._socket = null;
    }

    // ── Defensive Checks (constraint 12) ───────────────────────────────────

    /** @private */
    _assertConnected() {
        if (this._connectionState === ConnectionState.DESTROYED) {
            throw new Error("[Verve] Session has been destroyed");
        }
        if (this._connectionState !== ConnectionState.CONNECTED) {
            throw new Error("[Verve] Not connected. Call joinRoom() first.");
        }
        if (!this._socket) {
            throw new Error("[Verve] Socket not available");
        }
    }

    /** @private */
    _assertNotDestroyed() {
        if (this._connectionState === ConnectionState.DESTROYED) {
            throw new Error("[Verve] Session has been destroyed and cannot be reused");
        }
    }
}

/**
 * VerveSDK — Developer-facing entry point for the Verve communication SDK.
 *
 * Framework-agnostic (constraint 5). This module contains zero React code.
 * React bindings live in VerveProvider.jsx and the prebuilt components.
 *
 * Usage:
 *   import Verve from "@verve/sdk";
 *   const session = await Verve.init({ apiKey, roomId, user: { name: "Alice" } });
 *   await session.joinRoom();  // socket created here, not during init (constraint 4)
 */

import { VerveSession } from "./VerveSession";

const API_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) ||
    "http://localhost:5000";

const Verve = {
    /** SDK version — for compatibility tracking (constraint 6) */
    version: "0.1.0",

    /**
     * Initialize a Verve session.
     *
     * This is lightweight (constraint 4):
     *   - Fetches an embed JWT from the tenant API
     *   - Returns a configured VerveSession
     *   - Does NOT create sockets, transports, or media streams
     *   - Actual RTC connection happens when session.joinRoom() is called
     *
     * @param {Object} options
     * @param {string}  options.apiKey           — Tenant API key
     * @param {string}  options.roomId           — Room ID
     * @param {Object}  options.user             — Guest identity
     * @param {string}  options.user.name        — Display name
     * @param {string}  [options.user.role]      — "host" | "participant"
     * @param {string}  [options.serverUrl]      — Backend URL override
     * @param {Object}  [options.config]         — Room configuration
     * @param {boolean} [options.config.chatEnabled=true]
     * @param {boolean} [options.config.screenShareEnabled=true]
     * @param {boolean} [options.config.cameraEnabled=true]
     * @param {Object}  [options.theme]          — CSS variable overrides
     * @returns {Promise<VerveSession>}
     */
    async init(options) {
        const {
            apiKey,
            roomId,
            user,
            serverUrl = API_URL,
            config = {},
            theme = {},
        } = options || {};

        // ── Defensive validation (constraint 12) ────────────────────────
        if (!apiKey || typeof apiKey !== "string") {
            throw new Error("[Verve] apiKey is required");
        }
        if (!roomId || typeof roomId !== "string") {
            throw new Error("[Verve] roomId is required");
        }
        if (!user?.name || typeof user.name !== "string") {
            throw new Error("[Verve] user.name is required");
        }

        // Fetch embed JWT from the existing tenant token endpoint (Phase 1 API)
        const tokenRes = await fetch(`${serverUrl}/api/tenant/rooms/${roomId}/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                guestName: user.name,
                role: user.role || "participant",
            }),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.json().catch(() => ({}));
            throw new Error(`[Verve] Token request failed: ${err.error || tokenRes.statusText}`);
        }

        const { token, guestId } = await tokenRes.json();

        // Merge config defaults
        const roomConfig = {
            chatEnabled:        config.chatEnabled !== false,
            screenShareEnabled: config.screenShareEnabled !== false,
            cameraEnabled:      config.cameraEnabled !== false,
        };

        // Return a configured session — no socket/RTC created yet (constraint 4)
        return new VerveSession({
            token,
            roomId,
            guestId,
            guestName: user.name,
            role: user.role || "participant",
            serverUrl,
            config: roomConfig,
            theme,
            apiKey,
        });
    },
};

export default Verve;

/**
 * @verve/sdk — Public API surface
 *
 * Architecture (constraint 5 — framework separation):
 *   Vanilla SDK Core: Verve, VerveSession, VerveEventEmitter, ConnectionState, SdkEvent
 *   React Bindings:   VerveProvider, useVerveSession
 *   Prebuilt UI:      VerveRoom, VerveControls, VerveChat, VerveParticipants
 *
 * Usage:
 *   import Verve, { VerveRoom, VerveProvider, SdkEvent } from "@verve/sdk";
 */

// ── Vanilla SDK Core (framework-agnostic) ───────────────────────────────────
export { default as default }                 from "./VerveSDK";
export { VerveSession, ConnectionState, SdkEvent } from "./VerveSession";
export { VerveEventEmitter }                  from "./VerveEventEmitter";
export { buildEmbedUrl, mountEmbed }          from "./VerveEmbed";

// ── React Bindings ──────────────────────────────────────────────────────────
export { VerveProvider, useVerveSession }      from "./VerveProvider";

// ── Prebuilt UI Components ──────────────────────────────────────────────────
export { default as VerveRoom }               from "./VerveRoom";
export { default as VerveControls }           from "./VerveControls";
export { default as VerveChat }               from "./VerveChat";
export { default as VerveParticipants }       from "./VerveParticipants";

// ── Theme CSS ───────────────────────────────────────────────────────────────
import "./VerveTheme.css";

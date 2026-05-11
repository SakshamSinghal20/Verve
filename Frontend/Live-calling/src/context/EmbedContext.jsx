import { createContext, useContext } from "react";

/**
 * EmbedContext — single centralized source of truth for embed mode state.
 *
 * Consumed by any component that needs to branch on embed vs. normal mode.
 * Avoids scattered prop-drilling or repeated `!!token` checks in components.
 *
 * Usage:
 *   const { isEmbedMode, embedToken, tenantId } = useEmbed();
 */
export const EmbedContext = createContext({
    isEmbedMode: false,
    embedToken:  null,
    tenantId:    null,
    roomId:      null,
    role:        null,
});

export function useEmbed() {
    return useContext(EmbedContext);
}

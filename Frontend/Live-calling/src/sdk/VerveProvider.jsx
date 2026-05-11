/**
 * VerveProvider — React context for supplying a VerveSession to prebuilt components.
 *
 * Usage:
 *   const session = await Verve.init({ ... });
 *   <VerveProvider session={session}>
 *     <VerveRoom />
 *   </VerveProvider>
 */

import React, { createContext, useContext, useEffect, useState } from "react";

const VerveSessionContext = createContext(null);

/**
 * Hook to access the current VerveSession from prebuilt components.
 * @returns {import("./VerveSession").VerveSession}
 */
export function useVerveSession() {
    const session = useContext(VerveSessionContext);
    if (!session) {
        throw new Error("[Verve] useVerveSession must be used within <VerveProvider>");
    }
    return session;
}

/**
 * Provider that applies the SDK theme and supplies session context.
 *
 * @param {Object} props
 * @param {import("./VerveSession").VerveSession} props.session
 * @param {React.ReactNode} props.children
 */
export function VerveProvider({ session, children }) {
    // Apply theme CSS variables from session.theme
    const [themeStyle, setThemeStyle] = useState({});

    useEffect(() => {
        if (!session?.theme) return;
        const vars = {};
        if (session.theme.primary) vars["--verve-primary"] = session.theme.primary;
        if (session.theme.bg)      vars["--verve-bg"]      = session.theme.bg;
        if (session.theme.text)    vars["--verve-text"]    = session.theme.text;
        if (session.theme.border)  vars["--verve-border"]  = session.theme.border;
        setThemeStyle(vars);
    }, [session?.theme]);

    return (
        <VerveSessionContext.Provider value={session}>
            <div className="verve-root" style={themeStyle}>
                {children}
            </div>
        </VerveSessionContext.Provider>
    );
}

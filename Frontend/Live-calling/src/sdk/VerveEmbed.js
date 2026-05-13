const DEFAULT_ALLOW = [
    "camera",
    "microphone",
    "display-capture",
    "fullscreen",
    "clipboard-write",
].join("; ");

function resolveContainer(container) {
    if (typeof document === "undefined") {
        throw new Error("[Verve] embed() requires a browser environment");
    }
    if (typeof container === "string") {
        const el = document.querySelector(container);
        if (!el) throw new Error(`[Verve] Container not found: ${container}`);
        return el;
    }
    if (container instanceof Element) return container;
    throw new Error("[Verve] container must be a selector or DOM element");
}

function normalizeBaseUrl(url) {
    return String(url || "").replace(/\/+$/, "");
}

export function buildEmbedUrl({
    embedUrl,
    roomId,
    token,
    frontendUrl,
    searchParams = {},
} = {}) {
    if (embedUrl) {
        const url = new URL(embedUrl, typeof window !== "undefined" ? window.location.href : undefined);
        if (token && !url.searchParams.has("token")) url.searchParams.set("token", token);
        Object.entries(searchParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
        });
        return url.toString();
    }

    if (!roomId || !token) {
        throw new Error("[Verve] embed() needs either embedUrl or both roomId and token");
    }

    const base = normalizeBaseUrl(
        frontendUrl ||
        (typeof window !== "undefined" ? window.location.origin : "")
    );
    if (!base) throw new Error("[Verve] frontendUrl is required outside the browser");

    const url = new URL(`${base}/embed/${encodeURIComponent(roomId)}`);
    url.searchParams.set("token", token);
    Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
    return url.toString();
}

export function mountEmbed({
    container,
    embedUrl,
    roomId,
    token,
    frontendUrl,
    title = "Verve meeting",
    className = "verve-embed-frame",
    allow = DEFAULT_ALLOW,
    style = {},
    searchParams,
} = {}) {
    const target = resolveContainer(container);
    const src = buildEmbedUrl({ embedUrl, roomId, token, frontendUrl, searchParams });

    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = title;
    iframe.allow = allow;
    iframe.className = className;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.minHeight = "420px";
    iframe.style.border = "0";
    iframe.style.borderRadius = "inherit";
    iframe.style.display = "block";
    Object.assign(iframe.style, style);

    target.replaceChildren(iframe);

    return {
        iframe,
        src,
        update(nextOptions = {}) {
            const nextSrc = buildEmbedUrl({
                embedUrl,
                roomId,
                token,
                frontendUrl,
                searchParams,
                ...nextOptions,
            });
            iframe.src = nextSrc;
            this.src = nextSrc;
            return nextSrc;
        },
        destroy() {
            iframe.remove();
        },
    };
}

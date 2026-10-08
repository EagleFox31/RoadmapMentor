/** Safe link rendering and explicitly supported third-party video embeddings. */
export interface SupportedVideoEmbed {
  provider: "YouTube" | "Vimeo";
  embedUrl: string;
}

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
const VIMEO_ID = /^[0-9]{5,15}$/;

export function safeExternalResourceUrl(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim() || input.length > 2048) return null;
  try {
    const url = new URL(input.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") ||
        !url.hostname || url.username || url.password) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Only trusted provider domains are ever turned into iframe source URLs.
 * Hostnames are compared exactly (never by suffix/substrings).
 * Other VIDEO links remain external, without an arbitrary iframe.
 */
export function supportedVideoEmbed(input: unknown): SupportedVideoEmbed | null {
  const safe = safeExternalResourceUrl(input);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.protocol !== "https:" || url.port) return null;

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    if (parts.length === 1) id = parts[0];
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (parts.length === 2 && ["shorts", "embed", "live"].includes(parts[0])) id = parts[1];
  }

  if (id && YOUTUBE_ID.test(id)) {
    return {
      provider: "YouTube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    };
  }

  if (host === "vimeo.com" || host === "www.vimeo.com") {
    if (parts.length === 1) id = parts[0];
  } else if (host === "player.vimeo.com") {
    if (parts.length === 2 && parts[0] === "video") id = parts[1];
  }
  if (id && VIMEO_ID.test(id)) {
    return { provider: "Vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  return null;
}

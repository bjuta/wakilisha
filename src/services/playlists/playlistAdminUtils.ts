export function slugifyPlaylistTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function parseProviderTrackUrl(
  rawUrl: string,
): {
  providerKey: string | null;
  providerTrackId: string | null;
  providerUrl: string | null;
} {
  const value = rawUrl.trim();
  if (!value) {
    return {
      providerKey: null,
      providerTrackId: null,
      providerUrl: null,
    };
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);

    if (host.endsWith("spotify.com")) {
      const trackIndex = parts.indexOf("track");
      return {
        providerKey: "spotify",
        providerTrackId:
          trackIndex >= 0 ? parts[trackIndex + 1] ?? null : null,
        providerUrl: url.toString(),
      };
    }

    if (host.endsWith("music.apple.com")) {
      return {
        providerKey: "apple_music",
        providerTrackId: url.searchParams.get("i"),
        providerUrl: url.toString(),
      };
    }

    if (host === "youtu.be") {
      return {
        providerKey: "youtube",
        providerTrackId: parts[0] ?? null,
        providerUrl: url.toString(),
      };
    }

    if (host.endsWith("youtube.com")) {
      return {
        providerKey: "youtube",
        providerTrackId: url.searchParams.get("v"),
        providerUrl: url.toString(),
      };
    }

    if (host.replace(/^www\./, "") === "soundcloud.com") {
      return {
        providerKey: "soundcloud",
        providerTrackId: null,
        providerUrl: url.toString(),
      };
    }

    return {
      providerKey: null,
      providerTrackId: null,
      providerUrl: url.toString(),
    };
  } catch {
    return {
      providerKey: null,
      providerTrackId: null,
      providerUrl: value,
    };
  }
}

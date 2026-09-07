const ALLOWED_PLAYLIST_TAGS = new Set([
  "p",
  "h2",
  "h3",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "br",
]);

const SAFE_EXTERNAL_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mailto:",
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function plainTextToHtml(value: string): string {
  return value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => {
      const safe = escapeHtml(paragraph.trim())
        .replace(/\n/g, "<br>");

      return safe ? `<p>${safe}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

function isRichPlaylistHtml(value: string): boolean {
  return /<\/?(?:p|h2|h3|strong|em|u|s|ul|ol|li|a|br)\b/i.test(
    value,
  );
}

function safeHref(value: string): string | null {
  const href = value.trim();

  if (!href) {
    return null;
  }

  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }

  try {
    const parsed = new URL(
      href,
      "https://wakilisha.africa",
    );

    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)
      ? href
      : null;
  } catch {
    return null;
  }
}

export function playlistDescriptionToPlainText(
  description: string | null | undefined,
): string {
  const value = description?.trim() ?? "";

  if (!value) {
    return "";
  }

  if (
    typeof DOMParser !== "undefined" &&
    isRichPlaylistHtml(value)
  ) {
    const documentValue = new DOMParser().parseFromString(
      value,
      "text/html",
    );

    return (documentValue.body.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return decodeBasicEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|h2|h3|li)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function playlistDescriptionToSafeHtml(
  description: string | null | undefined,
): string {
  const value = description?.trim() ?? "";

  if (!value) {
    return "";
  }

  if (!isRichPlaylistHtml(value)) {
    return plainTextToHtml(value);
  }

  if (typeof DOMParser === "undefined") {
    return plainTextToHtml(
      playlistDescriptionToPlainText(value),
    );
  }

  const documentValue = new DOMParser().parseFromString(
    value,
    "text/html",
  );

  const elements = Array.from(
    documentValue.body.querySelectorAll("*"),
  );

  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    const originalHref =
      tag === "a"
        ? element.getAttribute("href") ?? ""
        : "";

    if (!ALLOWED_PLAYLIST_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }

    if (tag !== "a") {
      continue;
    }

    const href = safeHref(originalHref);

    if (!href) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    element.setAttribute("href", href);

    if (href.startsWith("/") && !href.startsWith("//")) {
      continue;
    }

    element.setAttribute("target", "_blank");
    element.setAttribute(
      "rel",
      "noopener noreferrer",
    );
  }

  return documentValue.body.innerHTML;
}

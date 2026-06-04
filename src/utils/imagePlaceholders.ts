export type PlaceholderEntityType =
  | "artist"
  | "track"
  | "release"
  | "label"
  | "genre"
  | "article"
  | "chart"
  | "profile"
  | "default";

export type PlaceholderImageIdentity = {
  id?: string | number | null;
  slug?: string | null;
  name?: string | null;
  type?: PlaceholderEntityType;
};

export type PlaceholderImageOptions = {
  width?: number;
  height?: number;
  label?: string;
};

const PALETTE = [
  ["#3A2A1F", "#84C241"],
  ["#2A1F3A", "#D85AAB"],
  ["#1F3A2A", "#4FD9C2"],
  ["#3A2A1F", "#E8A23A"],
  ["#1A2E3A", "#6BA8F5"],
  ["#2E1A1A", "#D6766A"],
  ["#2A2618", "#C7A06D"],
  ["#241F3A", "#9C8FF5"],
] as const;

const TYPE_LABELS: Record<PlaceholderEntityType, string> = {
  artist: "WAKILISHA ARTIST",
  track: "WAKILISHA TRACK",
  release: "WAKILISHA RELEASE",
  label: "WAKILISHA LABEL",
  genre: "WAKILISHA GENRE",
  article: "WAKILISHA EDITORIAL",
  chart: "WAKILISHA CHART",
  profile: "WAKILISHA PROFILE",
  default: "WAKILISHA",
};

export function hasUsableImageUrl(url?: string | null): url is string {
  if (!url) return false;
  const normalized = String(url).trim();
  if (!normalized) return false;
  return !["null", "undefined", "false", "0"].includes(normalized.toLowerCase());
}

export function createImagePlaceholderDataUrl(
  identity: PlaceholderImageIdentity,
  options: PlaceholderImageOptions = {}
): string {
  const type = identity.type ?? "default";
  const name = normalizeName(identity.name, type);
  const seed = String(identity.id ?? identity.slug ?? identity.name ?? type);
  const hash = hashSeed(seed);
  const [from, to] = PALETTE[hash % PALETTE.length];
  const width = options.width ?? defaultWidth(type);
  const height = options.height ?? defaultHeight(type, width);
  const label = options.label ?? TYPE_LABELS[type];
  const displayName = truncateForSvg(name, width >= 900 ? 52 : width >= 600 ? 34 : 24);
  const titleSize = Math.max(18, Math.min(64, Math.round(width / 12)));
  const labelSize = Math.max(10, Math.min(18, Math.round(width / 48)));
  const pad = Math.max(18, Math.round(width * 0.07));
  const labelY = Math.max(pad + labelSize, height - pad - titleSize - 18);
  const titleY = height - pad;
  const circleA = Math.round(width * 0.32);
  const circleB = Math.round(width * 0.42);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvg(displayName)} placeholder image">
  <defs>
    <linearGradient id="wk-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="wk-glow-a" cx="30%" cy="20%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wk-glow-b" cx="80%" cy="85%" r="65%">
      <stop offset="0%" stop-color="#080908" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#080908" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#wk-bg)"/>
  <circle cx="${Math.round(width * 0.18)}" cy="${Math.round(height * 0.22)}" r="${circleA}" fill="url(#wk-glow-a)"/>
  <circle cx="${Math.round(width * 0.92)}" cy="${Math.round(height * 0.9)}" r="${circleB}" fill="url(#wk-glow-b)"/>
  <path d="M${pad} ${Math.round(height * 0.2)} H${width - pad}" stroke="#F0EFE8" stroke-opacity="0.08" stroke-width="1"/>
  <path d="M${pad} ${Math.round(height * 0.2 + 18)} H${Math.round(width * 0.62)}" stroke="#F0EFE8" stroke-opacity="0.08" stroke-width="1"/>
  <text x="${pad}" y="${labelY}" fill="#F0EFE8" fill-opacity="0.72" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="${labelSize}" font-weight="800" letter-spacing="${Math.max(2, Math.round(labelSize * 0.35))}">${escapeSvg(label)}</text>
  <text x="${pad}" y="${titleY}" fill="#FFFFFF" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="${titleSize}" font-weight="800" letter-spacing="-1.2">${escapeSvg(displayName)}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function withPlaceholderImage(
  imageUrl: string | null | undefined,
  identity: PlaceholderImageIdentity,
  options?: PlaceholderImageOptions
): string {
  return hasUsableImageUrl(imageUrl)
    ? imageUrl.trim()
    : createImagePlaceholderDataUrl(identity, options);
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function normalizeName(name: string | null | undefined, type: PlaceholderEntityType): string {
  const clean = String(name ?? "").trim();
  if (clean) return clean;
  if (type === "article") return "Untitled story";
  if (type === "chart") return "Untitled chart";
  return "WAKILISHA";
}

function truncateForSvg(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…` : value;
}

function defaultWidth(type: PlaceholderEntityType): number {
  if (type === "article" || type === "chart") return 1200;
  if (type === "artist" || type === "profile") return 800;
  return 600;
}

function defaultHeight(type: PlaceholderEntityType, width: number): number {
  if (type === "article") return Math.round((width * 9) / 16);
  if (type === "chart") return Math.round(width / 2);
  if (type === "artist" || type === "profile") return Math.round((width * 5) / 4);
  return width;
}

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

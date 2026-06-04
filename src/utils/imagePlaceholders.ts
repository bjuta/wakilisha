export function withPlaceholderImage(url?: string | null, _identity?: unknown): string {
  if (url == null) return "";
  const value = String(url).trim();
  if (value.length === 0 || value === "null" || value === "undefined") return "";
  return value;
}
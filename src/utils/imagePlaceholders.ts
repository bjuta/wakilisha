export function withPlaceholderImage(url?: string | null, _identity?: unknown): string {
  const value = String(url ?? "").trim();
  return value.length > 0 ? value : "";
}

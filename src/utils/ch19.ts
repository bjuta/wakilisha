export const ch19Gradients = [
  ["#3a2a1f", "#84C241"],
  ["#2a1f3a", "#D85AAB"],
  ["#1f3a2a", "#4FD9C2"],
  ["#3a2a1f", "#E8A23A"],
] as const;

export type Ch19Identity = {
  id?: string | number | null;
  slug?: string | null;
  name?: string | null;
};

export function ch19HasImage(url?: string | null): url is string {
  const value = String(url ?? "").trim();
  return value.length > 0;
}

export function ch19Name(identity: Ch19Identity): string {
  const value = String(identity.name ?? "").trim();
  return value || "WAKILISHA";
}

export function ch19Background(identity: Ch19Identity): string {
  const seed = String(identity.id ?? identity.slug ?? identity.name ?? "wakilisha");
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
  const pair = ch19Gradients[total % ch19Gradients.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

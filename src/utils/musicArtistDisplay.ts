export function splitMusicArtistDisplayNames(
  value: string | null | undefined,
): string[] {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  const bracketedFeature = clean.match(
    /^(.*?)\s*[([{]\s*(?:feat\.?|ft\.?|featuring)\s+(.+?)\s*[)\]}]\s*$/i,
  );

  const rawParts = bracketedFeature
    ? [
        bracketedFeature[1],
        ...bracketedFeature[2].split(/\s*,\s*/),
      ]
    : clean.split(
        /\s+(?:feat\.?|ft\.?|featuring)\s+|\s*,\s*/i,
      );

  const seen = new Set<string>();

  return rawParts.flatMap((part) => {
    const name = String(part || "")
      .trim()
      .replace(/^[([{]+\s*/, "")
      .replace(/\s*[)\]}]+$/, "")
      .replace(/^(?:feat\.?|ft\.?|featuring)\s+/i, "")
      .trim();

    if (!name) return [];

    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return [];

    seen.add(key);
    return [name];
  });
}

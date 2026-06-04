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

export async function extractArtworkGradient(imageUrl: string, identity: Ch19Identity): Promise<string> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load artwork'));
      img.src = imageUrl;
    });

    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    // Sample 3 horizontal bands for a vertical gradient
    const bands = [
      { startRow: 0, endRow: 15 },
      { startRow: 16, endRow: 31 },
      { startRow: 32, endRow: 47 },
    ];

    const colors = bands.map((band) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = band.startRow; y <= band.endRow; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const idx = (y * size + x) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count += 1;
        }
      }
      return `rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)})`;
    });

    return `linear-gradient(180deg, ${colors.join(', ')})`;
  } catch {
    // Fallback to hash-based gradient if image can't be loaded (CORS, etc)
    return ch19Background(identity);
  }
}
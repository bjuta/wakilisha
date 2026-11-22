/**
 * An Instagram Story is an image export, not an Instagram publishing API.
 * Draw the published Article's selected artwork and editorial metadata using
 * the same Figtree display font and hero treatment as the WAKILISHA website.
 */
export interface ArticleStoryMetadata {
  author: string;
  readingTime: number;
  section: string;
}

export interface ArticleStorySource extends ArticleStoryMetadata {
  title: string;
  imageUrl: string;
}

export const ARTICLE_STORY_WIDTH = 1080;
export const ARTICLE_STORY_HEIGHT = 1920;

export function articleStoryCoverCrop(
  imageWidth: number,
  imageHeight: number,
  targetWidth = ARTICLE_STORY_WIDTH,
  targetHeight = ARTICLE_STORY_HEIGHT,
) {
  if (![imageWidth, imageHeight, targetWidth, targetHeight].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("The featured image has invalid dimensions.");
  }
  // Match the public Article hero's object-fit: cover. No letterboxing.
  const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const sw = targetWidth / scale;
  const sh = targetHeight / scale;
  return { sx: (imageWidth - sw) / 2, sy: (imageHeight - sh) / 2, sw, sh };
}

function measuredWidth(ctx: CanvasRenderingContext2D, value: string, spacing: number) {
  const letters = Array.from(value);
  return letters.reduce((width, letter) => width + ctx.measureText(letter).width, 0)
    + Math.max(0, letters.length - 1) * spacing;
}

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  spacing: number,
) {
  for (const letter of Array.from(value)) {
    ctx.fillText(letter, x, y);
    x += ctx.measureText(letter).width + spacing;
  }
}

function headlineLines(ctx: CanvasRenderingContext2D, title: string, width: number, spacing: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of title.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? line + " " + word : word;
    if (measuredWidth(ctx, candidate, spacing) <= width) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    // Do not truncate exceptionally long individual words.
    for (const letter of Array.from(word)) {
      const next = line + letter;
      if (line && measuredWidth(ctx, next, spacing) > width) {
        lines.push(line);
        line = "";
      }
      line += letter;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function loadPublicArtwork(rawUrl: string): Promise<HTMLImageElement> {
  let url: URL;
  try {
    url = new URL(rawUrl, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    if (url.username || url.password) throw new Error();
  } catch {
    throw new Error("This article does not have a usable featured image.");
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => image.naturalWidth && image.naturalHeight
      ? resolve(image)
      : reject(new Error("The featured image has no readable dimensions."));
    image.onerror = () => reject(new Error(
      "The featured image could not be exported. Please check media access and try again.",
    ));
    image.src = url.href;
  });
}

export async function renderArticleStoryImage(source: ArticleStorySource): Promise<Blob> {
  if (!source.title.trim() || !source.author.trim() || !source.section.trim()
    || !Number.isFinite(source.readingTime) || source.readingTime <= 0) {
    throw new Error("This article is missing published Story details.");
  }

  const [image] = await Promise.all([
    loadPublicArtwork(source.imageUrl),
    document.fonts.ready,
  ]);
  // The same canonical token drives the website headline. Wait for the actual
  // Figtree face before measuring and drawing, rather than baking a substitute.
  await document.fonts.load('800 96px Figtree');
  const computed = getComputedStyle(document.documentElement);
  const displayFont = computed.getPropertyValue("--wk-font-display").trim()
    || "'Figtree', system-ui, sans-serif";
  const bodyFont = computed.getPropertyValue("--wk-font-body").trim()
    || "'Figtree', system-ui, sans-serif";
  const brand = computed.getPropertyValue("--wk-brand").trim() || "#85C441";

  const canvas = document.createElement("canvas");
  canvas.width = ARTICLE_STORY_WIDTH;
  canvas.height = ARTICLE_STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is not supported by this browser.");

  const crop = articleStoryCoverCrop(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);

  // Match the current photographic Article hero: readable text over the image,
  // not a separate card or border. Reserve Instagram's top and bottom controls.
  const scrim = ctx.createLinearGradient(0, 0, 0, ARTICLE_STORY_HEIGHT);
  scrim.addColorStop(0, "rgba(0, 0, 0, .63)");
  scrim.addColorStop(.34, "rgba(0, 0, 0, .03)");
  scrim.addColorStop(.51, "rgba(0, 0, 0, .34)");
  scrim.addColorStop(.85, "rgba(0, 0, 0, .9)");
  scrim.addColorStop(1, "rgba(0, 0, 0, .96)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#F5F5F4";
  ctx.font = "800 48px " + displayFont;
  drawTrackedText(ctx, "WAKILISHA", 88, 260, -2.1);
  ctx.font = "800 22px " + bodyFont;
  ctx.fillStyle = brand;
  drawTrackedText(ctx, "MAGAZINE", 90, 324, 3.5);

  const title = source.title.trim();
  let size = 102;
  let lines: string[] = [];
  for (; size >= 46; size -= 2) {
    ctx.font = "800 " + size + "px " + displayFont;
    lines = headlineLines(ctx, title, 900, -size * .055);
    const height = lines.length * size * 1.035;
    if (height <= 920 && 1414 - height - 80 >= 418) break;
  }
  if (size < 46) throw new Error("The article headline is too long for a readable Story.");

  const lineHeight = size * 1.035;
  const titleTop = 1414 - lines.length * lineHeight;
  ctx.fillStyle = brand;
  ctx.font = "800 26px " + bodyFont;
  ctx.fillText(source.section.trim().toUpperCase(), 90, titleTop - 63, 900);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 " + size + "px " + displayFont;
  for (let index = 0; index < lines.length; index += 1) {
    drawTrackedText(ctx, lines[index], 87, titleTop + index * lineHeight, -size * .055);
  }

  ctx.font = "700 33px " + bodyFont;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(source.author.trim(), 90, 1488, 900);
  ctx.fillStyle = "rgba(255, 255, 255, .85)";
  ctx.font = "500 27px " + bodyFont;
  ctx.fillText(String(source.readingTime) + " min read", 90, 1538, 900);

  ctx.strokeStyle = "rgba(255, 255, 255, .48)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 1600);
  ctx.lineTo(990, 1600);
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 29px " + bodyFont;
  ctx.fillText("wakilisha.africa", 90, 1630, 880);

  // A raster image cannot contain a functional Instagram Link sticker.
  // The sharing UI separately copies the canonical Article destination.
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("The Story image could not be saved.")),
        "image/jpeg",
        .93,
      );
    } catch {
      reject(new Error("The featured image cannot be exported from this browser."));
    }
  });
}

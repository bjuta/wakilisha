const MEDIA_ORIGIN = "https://media.wakilisha.africa";

export const RESPONSIVE_MEDIA_WIDTHS = [
  320,
  480,
  640,
  768,
  960,
  1280,
  1600,
] as const;

export type ResponsiveMediaWidth =
  (typeof RESPONSIVE_MEDIA_WIDTHS)[number];

export type ResponsiveImagePreset =
  | "hero"
  | "lead"
  | "feature"
  | "card"
  | "thumbnail";

type ResponsiveImagePresetDefinition = {
  widths: readonly ResponsiveMediaWidth[];
  sizes: string;
  fallbackWidth: ResponsiveMediaWidth;
};

const RESPONSIVE_IMAGE_PRESETS: Record<
  ResponsiveImagePreset,
  ResponsiveImagePresetDefinition
> = {
  hero: {
    widths: [640, 768, 960, 1280, 1600],
    sizes: "100vw",
    fallbackWidth: 1280,
  },
  lead: {
    widths: [480, 640, 768, 960, 1280],
    sizes: "(max-width: 1024px) 100vw, 50vw",
    fallbackWidth: 960,
  },
  feature: {
    widths: [480, 640, 768, 960, 1280],
    sizes:
      "(max-width: 640px) 100vw, (max-width: 1024px) 85vw, 640px",
    fallbackWidth: 960,
  },
  card: {
    widths: [320, 480, 640, 768],
    sizes:
      "(max-width: 640px) 50vw, (max-width: 1024px) 42vw, 33vw",
    fallbackWidth: 640,
  },
  thumbnail: {
    widths: [320, 480],
    sizes: "96px",
    fallbackWidth: 320,
  },
};

export type ResponsiveImageDefinition = {
  src: string;
  srcSet?: string;
  sizes?: string;
  optimized: boolean;
};

function resolveMediaUrl(source: string): URL | null {
  const value = String(source || "").trim();

  if (!value) return null;

  try {
    if (value.startsWith("/uploads/")) {
      return new URL(value, MEDIA_ORIGIN);
    }

    return new URL(value);
  } catch {
    return null;
  }
}

function isTransformableMediaUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (url.hostname !== "media.wakilisha.africa") return false;
  if (!url.pathname.startsWith("/uploads/")) return false;

  return /\.(?:jpe?g|png|webp)$/i.test(url.pathname);
}

function responsiveVariantUrl(
  url: URL,
  width: ResponsiveMediaWidth,
): string {
  return (
    `${MEDIA_ORIGIN}/__image/w${width}` +
    `${url.pathname}${url.search}`
  );
}

export function getResponsiveImageDefinition(
  source: string,
  preset: ResponsiveImagePreset = "card",
): ResponsiveImageDefinition {
  const parsed = resolveMediaUrl(source);

  if (!parsed || !isTransformableMediaUrl(parsed)) {
    return {
      src: source,
      optimized: false,
    };
  }

  const definition = RESPONSIVE_IMAGE_PRESETS[preset];

  return {
    src: responsiveVariantUrl(
      parsed,
      definition.fallbackWidth,
    ),
    srcSet: definition.widths
      .map(
        (width) =>
          `${responsiveVariantUrl(parsed, width)} ${width}w`,
      )
      .join(", "),
    sizes: definition.sizes,
    optimized: true,
  };
}

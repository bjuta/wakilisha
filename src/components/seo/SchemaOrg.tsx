import { useEffect } from "react";

export interface MusicGroupSchema {
  "@type": "MusicGroup";
  name: string;
  image?: string;
  description?: string;
  genre?: string[];
  url?: string;
  sameAs?: string[];
}

export interface MusicAlbumSchema {
  "@type": "MusicAlbum";
  name: string;
  byArtist?: { "@type": "MusicGroup"; name: string; url?: string };
  image?: string;
  datePublished?: string;
  numTracks?: number;
  genre?: string[];
  url?: string;
  track?: Array<{ "@type": "MusicRecording"; name: string; duration?: string; position?: number }>;
}

export interface MusicRecordingSchema {
  "@type": "MusicRecording";
  name: string;
  byArtist?: { "@type": "MusicGroup"; name: string; url?: string };
  image?: string;
  duration?: string;
  datePublished?: string;
  inAlbum?: { "@type": "MusicAlbum"; name: string; url?: string };
  genre?: string[];
  isrcCode?: string;
  url?: string;
}

export interface OrganizationSchema {
  "@type": "Organization";
  name: string;
  description?: string;
  image?: string;
  url?: string;
}

export interface ArticleSchema {
  "@type": "Article";
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: { "@type": "Person"; name: string; url?: string };
  publisher?: { "@type": "Organization"; name: string; logo?: { "@type": "ImageObject"; url: string } };
  url?: string;
}

export interface FAQPageSchema {
  "@type": "FAQPage";
  mainEntity: Array<{ "@type": "Question"; name: string; acceptedAnswer: { "@type": "Answer"; text: string } }>;
}

export interface WebPageSchema {
  "@type": "WebPage";
  name: string;
  description?: string;
  url?: string;
  breadcrumb?: {
    "@type": "BreadcrumbList";
    itemListElement: Array<{ "@type": "ListItem"; position: number; name: string; item: string }>;
  };
}

export type SchemaData =
  | MusicGroupSchema
  | MusicAlbumSchema
  | MusicRecordingSchema
  | OrganizationSchema
  | ArticleSchema
  | FAQPageSchema
  | WebPageSchema;

interface SchemaOrgProps {
  data: SchemaData | SchemaData[];
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "PT0S";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `PT${s}S`;
  if (s === 0) return `PT${m}M`;
  return `PT${m}M${s}S`;
}

function buildJsonLd(data: SchemaData | SchemaData[]): Record<string, unknown> {
  const items = Array.isArray(data) ? data : [data];
  const schemas = items.map((item) => {
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": item["@type"],
    };

    switch (item["@type"]) {
      case "MusicGroup": {
        const d = item as MusicGroupSchema;
        schema.name = d.name;
        if (d.image) schema.image = d.image;
        if (d.description) schema.description = d.description;
        if (d.genre) schema.genre = d.genre;
        if (d.url) schema.url = d.url;
        if (d.sameAs) schema.sameAs = d.sameAs;
        break;
      }
      case "MusicAlbum": {
        const d = item as MusicAlbumSchema;
        schema.name = d.name;
        if (d.byArtist) schema.byArtist = d.byArtist;
        if (d.image) schema.image = d.image;
        if (d.datePublished) schema.datePublished = d.datePublished;
        if (d.numTracks) schema.numTracks = d.numTracks;
        if (d.genre) schema.genre = d.genre;
        if (d.url) schema.url = d.url;
        if (d.track) schema.track = d.track;
        break;
      }
      case "MusicRecording": {
        const d = item as MusicRecordingSchema;
        schema.name = d.name;
        if (d.byArtist) schema.byArtist = d.byArtist;
        if (d.image) schema.image = d.image;
        if (d.duration) schema.duration = d.duration;
        if (d.datePublished) schema.datePublished = d.datePublished;
        if (d.inAlbum) schema.inAlbum = d.inAlbum;
        if (d.genre) schema.genre = d.genre;
        if (d.isrcCode) schema.isrcCode = d.isrcCode;
        if (d.url) schema.url = d.url;
        break;
      }
      case "Organization": {
        const d = item as OrganizationSchema;
        schema.name = d.name;
        if (d.description) schema.description = d.description;
        if (d.image) schema.image = d.image;
        if (d.url) schema.url = d.url;
        break;
      }
      case "Article": {
        const d = item as ArticleSchema;
        schema.headline = d.headline;
        if (d.description) schema.description = d.description;
        if (d.image) schema.image = d.image;
        if (d.datePublished) schema.datePublished = d.datePublished;
        if (d.dateModified) schema.dateModified = d.dateModified;
        if (d.author) schema.author = d.author;
        if (d.publisher) schema.publisher = d.publisher;
        if (d.url) schema.url = d.url;
        break;
      }
      case "FAQPage": {
        const d = item as FAQPageSchema;
        schema.mainEntity = d.mainEntity;
        break;
      }
      case "WebPage": {
        const d = item as WebPageSchema;
        schema.name = d.name;
        if (d.description) schema.description = d.description;
        if (d.url) schema.url = d.url;
        if (d.breadcrumb) schema.breadcrumb = d.breadcrumb;
        break;
      }
    }

    return schema;
  });

  if (schemas.length === 1) return schemas[0] as Record<string, unknown>;
  return { "@context": "https://schema.org", "@graph": schemas };
}

export function SchemaOrg({ data }: SchemaOrgProps) {
  useEffect(() => {
    const jsonLd = buildJsonLd(data);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    script.setAttribute("data-schema-org", "true");
    document.head.appendChild(script);

    return () => {
      const existing = document.querySelector('script[data-schema-org="true"]');
      if (existing) existing.remove();
    };
  }, [data]);

  return null;
}

export { formatDuration };
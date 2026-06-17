import { useEffect } from "react";

export interface MetaTagsProps {
  title: string;
  description: string;
  imageUrl?: string;
  url?: string;
  type?: "website" | "article" | "music.song" | "music.album";
  artistName?: string;
  releaseDate?: string;
}

const SITE_NAME = "WAKILISHA";
const TWITTER_HANDLE = "@wakilisha";

function setMetaTag(property: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    if (property.startsWith("og:") || property.startsWith("music:")) {
      el.setAttribute("property", property);
    } else {
      el.setAttribute("name", property);
    }
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMetaTag(property: string) {
  const el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
  if (el) el.remove();
}

export function MetaTags({
  title,
  description,
  imageUrl,
  url,
  type = "website",
  artistName,
  releaseDate,
}: MetaTagsProps) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    setMetaTag("og:title", fullTitle);
    setMetaTag("og:description", description);
    setMetaTag("og:type", type);
    setMetaTag("og:site_name", SITE_NAME);

    setMetaTag("twitter:card", imageUrl ? "summary_large_image" : "summary");
    setMetaTag("twitter:title", fullTitle);
    setMetaTag("twitter:description", description);
    if (TWITTER_HANDLE) setMetaTag("twitter:site", TWITTER_HANDLE);

    if (url) {
      setMetaTag("og:url", url);
    }

    if (imageUrl) {
      setMetaTag("og:image", imageUrl);
      setMetaTag("og:image:width", "1200");
      setMetaTag("og:image:height", "630");
      setMetaTag("og:image:alt", title);
      setMetaTag("twitter:image", imageUrl);
      setMetaTag("twitter:image:alt", title);
    }

    if (type === "music.song" || type === "music.album") {
      if (artistName) {
        setMetaTag("music:musician", artistName);
      }
      if (releaseDate) {
        setMetaTag("music:release_date", releaseDate);
      }
    }

    setMetaTag("description", description);

    return () => {
      const tags = [
        "og:title", "og:description", "og:type", "og:site_name", "og:url",
        "og:image", "og:image:width", "og:image:height", "og:image:alt",
        "twitter:card", "twitter:title", "twitter:description", "twitter:site",
        "twitter:image", "twitter:image:alt",
        "music:musician", "music:release_date",
        "description",
      ];
      for (const tag of tags) {
        removeMetaTag(tag);
      }
    };
  }, [title, description, imageUrl, url, type, artistName, releaseDate]);

  return null;
}
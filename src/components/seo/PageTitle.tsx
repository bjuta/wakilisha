import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "WAKILISHA";

const STATIC_TITLES: Record<string, string> = {
  "/": "Home",
  "/charts": "Charts",
  "/artists": "Artists",
  "/magazine": "Magazine",
  "/guides": "Guides",
  "/search": "Search",
  "/releases": "Releases",
  "/genres": "Genres",
  "/labels": "Labels",
  "/admin": "Admin",
};

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPageTitle(title?: string | null): string {
  const clean = String(title || "").trim();

  if (!clean || clean.toUpperCase() === SITE_NAME) {
    return SITE_NAME;
  }

  return `${clean} | ${SITE_NAME}`;
}

export function titleFromPath(pathname: string): string {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  if (STATIC_TITLES[cleanPath]) {
    return STATIC_TITLES[cleanPath];
  }

  const parts = cleanPath.split("/").filter(Boolean);

  if (parts.length === 0) return SITE_NAME;

  if (parts[0] === "charts") {
    const edition = parts[3] || parts[1];
    return edition ? titleCase(edition) : "Charts";
  }

  if (parts[0] === "tracks") {
    const slug = parts[parts.length - 1];
    return slug ? titleCase(slug) : "Tracks";
  }

  if (parts[0] === "artists") {
    return parts[1] ? titleCase(parts[1]) : "Artists";
  }

  if (parts[0] === "magazine") {
    return parts[1] ? titleCase(parts[1]) : "Magazine";
  }

  if (parts[0] === "guides") {
    return parts[1] ? titleCase(parts[1]) : "Guides";
  }

  if (parts[0] === "releases") {
    return parts[parts.length - 1] ? titleCase(parts[parts.length - 1]) : "Releases";
  }

  if (parts[0] === "genres") {
    return parts[1] ? titleCase(parts[1]) : "Genres";
  }

  if (parts[0] === "labels") {
    return parts[1] ? titleCase(parts[1]) : "Labels";
  }

  return titleCase(parts[parts.length - 1] || SITE_NAME);
}

export function setPageTitle(title?: string | null): void {
  document.title = formatPageTitle(title);
}

export function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    setPageTitle(titleFromPath(location.pathname));
  }, [location.pathname]);

  return null;
}

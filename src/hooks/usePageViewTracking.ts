import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/services/analytics";

// ── Route → page_type inference ────────────────────────────────────
// Parses the URL pathname and returns page_type, entity_slug, and
// entity_type. Only covers public-facing routes — admin routes are
// skipped (returns null).

interface PageContext {
  pageType: string;
  entitySlug?: string;
  entityType?: string;
}

function inferPageContext(pathname: string): PageContext | null {
  // Skip admin routes — internal traffic
  if (pathname.startsWith("/admin")) return null;
  // Skip API docs
  if (pathname === "/api-docs") return { pageType: "api_docs" };

  // ── Exact matches ────────────────────────────────────────────
  if (pathname === "/") return { pageType: "home" };
  if (pathname === "/magazine" || pathname === "/") return { pageType: "home" };
  if (pathname === "/artists") return { pageType: "artist_listing" };
  if (pathname === "/releases") return { pageType: "release_listing" };
  if (pathname === "/genres") return { pageType: "genre_listing" };
  if (pathname === "/labels") return { pageType: "label_listing" };
  if (pathname === "/charts") return { pageType: "charts_directory" };
  if (pathname === "/guides") return { pageType: "guides_listing" };
  if (pathname === "/search") return { pageType: "search" };
  if (pathname === "/profile") return { pageType: "profile" };
  if (pathname === "/settings") return { pageType: "settings" };
  if (pathname === "/auth") return { pageType: "auth" };
  if (pathname === "/player") return { pageType: "player" };
  if (pathname === "/categories") return { pageType: "category_listing" };
  if (pathname === "/tags") return { pageType: "tag_listing" };

  // ── Parameterized routes — ──────────────────────────────────────
  const segments = pathname.split("/").filter(Boolean);

  // /magazine/:slug
  if (segments[0] === "magazine" && segments.length === 2) {
    // Skip issue routes handled below
    if (segments[1] === "issue" && segments.length >= 3) {
      return { pageType: "magazine_issue", entitySlug: segments[2], entityType: "magazine_issue" };
    }
    return { pageType: "article", entitySlug: segments[1], entityType: "article" };
  }

  // /artists/:slug/updates/:updateId
  if (
    segments[0] === "artists" &&
    segments.length === 4 &&
    segments[2] === "updates"
  ) {
    return {
      pageType: "artist_update",
      entitySlug: segments[3],
      entityType: "artist_update",
    };
  }

  // /artists/:slug
  if (segments[0] === "artists" && segments.length === 2) {
    return { pageType: "artist_detail", entitySlug: segments[1], entityType: "artist" };
  }

  // /tracks/:artistSlug/:trackSlug (main) or /tracks/:artistSlug/:trackSlug/lyrics/contribute
  if (segments[0] === "tracks" && segments.length >= 3) {
    return { pageType: "track_detail", entitySlug: segments[2], entityType: "track" };
  }

  // /releases/:artistSlug/:releaseSlug
  if (segments[0] === "releases" && segments.length === 3) {
    return { pageType: "release_detail", entitySlug: segments[2], entityType: "release" };
  }

  // /genres/:slug
  if (segments[0] === "genres" && segments.length === 2) {
    return { pageType: "genre_detail", entitySlug: segments[1], entityType: "genre" };
  }

  // /labels/:slug
  if (segments[0] === "labels" && segments.length === 2) {
    return { pageType: "label_detail", entitySlug: segments[1], entityType: "label" };
  }

  // /charts/:family/:market/:series/:edition etc. — all chart edition variants
  if (segments[0] === "charts" && segments.length >= 2) {
    // Last segment is the edition slug (or series if 2 segments)
    const editionSlug = segments[segments.length - 1];
    return { pageType: "charts_edition", entitySlug: editionSlug, entityType: "chart_edition" };
  }

  // /guides/:slug
  if (segments[0] === "guides" && segments.length === 2) {
    return { pageType: "guide_detail", entitySlug: segments[1], entityType: "guide" };
  }

  // /categories/:slug
  if (segments[0] === "categories" && segments.length === 2) {
    return { pageType: "category_detail", entitySlug: segments[1], entityType: "category" };
  }

  // /tags/:slug
  if (segments[0] === "tags" && segments.length === 2) {
    return { pageType: "tag_detail", entitySlug: segments[1], entityType: "tag" };
  }

  // /people/:slug
  if (segments[0] === "people" && segments.length === 2) {
    return { pageType: "person_detail", entitySlug: segments[1], entityType: "person" };
  }

  // /authors/:slug — legacy compatibility redirect only
  if (segments[0] === "authors" && segments.length === 2) {
    return { pageType: "legacy_author_redirect", entitySlug: segments[1], entityType: "person" };
  }

  // /preview/:nonce
  if (segments[0] === "preview" && segments.length === 2) {
    return { pageType: "preview" };
  }

  // Fallback — unknown route, still track it
  return { pageType: segments[0] || "unknown" };
}

// ── usePageViewTracking ────────────────────────────────────────────

export function usePageViewTracking(): void {
  const location = useLocation();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    const pathname = location.pathname;
    // Skip if same pathname (React sometimes fires on same location)
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    const ctx = inferPageContext(pathname);
    if (!ctx) return; // admin or other excluded route

    trackEvent("page_view", {
      pageType: ctx.pageType,
      entitySlug: ctx.entitySlug,
      entityType: ctx.entityType,
    });
  }, [location.pathname]);
}

// ── PageViewTracker component ──────────────────────────────────────
// Drop-in wrapper that just calls the hook. Renders nothing.

export function PageViewTracker(): null {
  usePageViewTracking();
  return null;
}
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/analytics";

/**
 * LegacyArticleRedirect
 *
 * Catches old WordPress-style article URLs like /some-article-slug/
 * and redirects them to /magazine/some-article-slug/.
 *
 * Also respects wk_slug_redirects — if an article's slug was changed
 * during migration (e.g. /old-slug → /magazine/new-slug), the redirect
 * table handles that second hop inside the article page.
 */

export default function LegacyArticleRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!slug) {
      setChecked(true);
      return;
    }

    let alive = true;

    async function resolve() {
      // 1. Check slug redirects first (explicit overrides)
      const { data: redirect } = await supabase
        .from("wk_slug_redirects")
        .select("new_slug")
        .eq("old_slug", slug)
        .eq("entity_type", "article")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const targetSlug = redirect?.new_slug || slug;

      // 2. Verify the target article exists
      const { data: article } = await supabase
        .from("wk_articles")
        .select("id")
        .eq("slug", targetSlug)
        .neq("wp_status", "trash")
        .maybeSingle();

      if (!alive) return;

      if (article) {
        navigate(`/magazine/${targetSlug}`, { replace: true });
      } else {
        const path = `${location.pathname}${location.search || ""}${location.hash || ""}`;

        trackEvent("page_not_found", {
          pageType: "404",
          entityType: "broken_page",
          entitySlug: slug,
          context: {
            status_code: 404,
            not_found_path: location.pathname,
            not_found_search: location.search || "",
            not_found_hash: location.hash || "",
            route_guess: "legacy_article_slug",
            suggested_fix: "",
            soft_404_surface: "legacy_article_redirect",
            attempted_slug: slug,
            attempted_target_slug: targetSlug,
            path,
          },
        });
      }

      setChecked(true);
    }

    resolve();

    return () => {
      alive = false;
    };
  }, [slug, navigate, location.pathname, location.search, location.hash]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="flex items-center gap-3 text-[var(--wk-text-muted)]">
          <i className="ri-loader-4-line animate-spin text-[20px]" />
          <span className="text-[14px]">Redirecting…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
      <div className="text-center">
        <p className="text-sm text-[var(--wk-text-muted)]">Page not found.</p>
      </div>
    </div>
  );
}
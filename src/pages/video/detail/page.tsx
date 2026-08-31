import { useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import { PublicVideoWatchingSurface } from "@/components/video/PublicVideoWatchingSurface";
import {
  getPublicVideoIndex,
  getPublicVideoPublication,
} from "@/services/video/videoPublicService";
import type {
  PublicVideoPublication,
} from "@/services/video/videoPublicModel";

export default function VideoDetailPage() {
  const { slug, showSlug, episodeSlug } = useParams<{
    slug?: string;
    showSlug?: string;
    episodeSlug?: string;
  }>();
  const location = useLocation();
  const resolvedSlug = episodeSlug || slug || "";
  const resolvedShowSlug = episodeSlug ? showSlug || null : null;
  const [publication, setPublication] =
    useState<PublicVideoPublication | null>(null);
  const [related, setRelated] = useState<PublicVideoPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setPublication(null);
    setRelated([]);

    Promise.all([
      getPublicVideoPublication(
        resolvedSlug,
        resolvedShowSlug,
      ),
      getPublicVideoIndex(24).catch(() => ({ items: [] })),
    ])
      .then(([value, index]) => {
        if (!alive) return;
        if (!value) {
          setNotFound(true);
          return;
        }
        setPublication(value);
        setRelated(
          index.items.filter((item) => {
            if (item.versionId === value.versionId) return false;
            if (value.show?.resourceId) {
              return item.show?.resourceId === value.show.resourceId;
            }
            return true;
          }),
        );
      })
      .catch(() => {
        if (alive) setNotFound(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [resolvedSlug, resolvedShowSlug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
        <div className="border-b border-[var(--wk-border)]">
          <div className="mx-auto h-14 max-w-[1180px] px-4 sm:px-6" />
        </div>
        <div className="mx-auto max-w-[1180px] sm:px-6">
          <div className="aspect-video animate-pulse bg-black/85 sm:mt-6 sm:rounded-[24px]" />
          <div className="px-5 py-7 sm:px-0">
            <div className="h-3 w-36 animate-pulse rounded bg-[var(--wk-surface)]" />
            <div className="mt-3 h-12 max-w-xl animate-pulse rounded-xl bg-[var(--wk-surface)]" />
            <div className="mt-4 h-4 max-w-sm animate-pulse rounded bg-[var(--wk-surface)]" />
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !publication) {
    return <Navigate to="/404" replace />;
  }

  if (publication.canonicalPath !== location.pathname) {
    return <Navigate to={publication.canonicalPath} replace />;
  }

  return (
    <>
      <MetaTags
        title={`${publication.title} | WAKILISHA Video`}
        description={
          publication.summary
          || `Watch ${publication.title} on WAKILISHA.`
        }
        url={`https://wakilisha.africa${publication.canonicalPath}`}
        imageUrl={publication.poster?.url || undefined}
      />
      <PublicVideoWatchingSurface
        publication={publication}
        related={related}
      />
    </>
  );
}

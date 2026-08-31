import { useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import { PublicVideoWatchingSurface } from "@/components/video/PublicVideoWatchingSurface";
import {
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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setPublication(null);

    getPublicVideoPublication(
      resolvedSlug,
      resolvedShowSlug,
    )
      .then((value) => {
        if (!alive) return;
        if (!value) {
          setNotFound(true);
          return;
        }
        setPublication(value);
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
      <main className="min-h-screen bg-wk-bg px-4 py-12 text-wk-text sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="h-4 w-36 animate-pulse rounded bg-wk-surface" />
          <div className="mt-5 h-14 max-w-2xl animate-pulse rounded-2xl bg-wk-surface" />
          <div className="mt-8 aspect-video animate-pulse rounded-[28px] bg-black/80" />
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
      <PublicVideoWatchingSurface publication={publication} />
    </>
  );
}

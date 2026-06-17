import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getArtist, type RepairedArtistDetail } from "@/services/repairedContent/client";
import { ArtistDetailHero } from "@/pages/artists/detail/components/ArtistDetailHero";
import { ArtistBioSection } from "@/pages/artists/detail/components/ArtistBioSection";
import { ArtistTopSongs } from "@/pages/artists/detail/components/ArtistTopSongs";
import { ArtistDiscography } from "@/pages/artists/detail/components/ArtistDiscography";
import { ArtistVideos } from "@/pages/artists/detail/components/ArtistVideos";
import { ArtistChartSection } from "@/pages/artists/detail/components/ArtistChartSection";
import { RelatedArtistsShelf } from "@/pages/artists/detail/components/RelatedArtistsShelf";

export default function MobileArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [artist, setArtist] = useState<RepairedArtistDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!slug) { setStatus("error"); setError("No artist slug provided"); return; }
    setStatus("loading");
    setError(null);
    getArtist(slug)
      .then((data) => {
        if (!alive) return;
        if (!data) { setStatus("error"); setError("Artist not found."); return; }
        setArtist(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load artist.");
        setStatus("error");
      });
    return () => { alive = false; };
  }, [slug]);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareSheet(false);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wk-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--wk-brand)]" />
          </div>
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">Loading artist…</span>
        </div>
      </div>
    );
  }

  if (status === "error" || !artist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center bg-[var(--wk-bg)]">
        <i className="ri-user-line text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="text-[20px] font-black text-[var(--wk-text)]">Artist not found</h1>
        <p className="text-[14px] text-[var(--wk-text-muted)]">{error || "This artist could not be found."}</p>
        <Link
          to="/artists"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)]"
        >
          <i className="ri-arrow-left-line" />
          Back to Artists
        </Link>
      </div>
    );
  }

  const releaseYears = artist.releases
    .map((r) => (r.releaseDate ? parseInt(r.releaseDate.split("-")[0], 10) : 0))
    .filter((y) => y > 0);
  const debutYear = releaseYears.length > 0 ? Math.min(...releaseYears) : new Date().getFullYear();

  const hasBio = Boolean(artist.bio || artist.fullBio);
  const hasTopSongs = artist.topSongs.length > 0;
  const appearances = Array.isArray((artist as any).appearances) ? (artist as any).appearances : [];
  const hasReleases = artist.releases.length > 0;
  const hasAppearances = appearances.length > 0;
  const hasVideos = artist.videos && artist.videos.length > 0;
  const hasChartEntries = artist.chartEntries.length > 0;
  const hasRelated = artist.relatedArtists.length > 0;

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">

      {/* ── Mobile floating back + share buttons overlaid on the hero ── */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pt-safe-top pt-4 pointer-events-none">
        <Link
          to="/artists"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all active:scale-95"
          aria-label="Back to Artists"
        >
          <i className="ri-arrow-left-line text-lg" />
        </Link>
        <button
          onClick={() => setShowShareSheet(true)}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all active:scale-95"
          aria-label="Share"
        >
          <i className="ri-share-line text-lg" />
        </button>
      </div>

      {/* ── Hero — same as desktop ── */}
      <ArtistDetailHero
        name={artist.name}
        imageUrl={artist.imageUrl}
        profileImageUrl={artist.profileImageUrl || artist.imageUrl}
        bio={artist.bio}
        isRising={artist.isRising}
        spotifyUrl={artist.spotifyUrl}
        artistType={artist.artistType}
      />

      {/* ── Main content ── */}
      <div className="px-4 py-10 md:px-6 md:py-14">
        <div className="space-y-14 max-w-5xl">

          {hasBio && (
            <ArtistBioSection
              bio={artist.bio}
              fullBio={artist.fullBio}
              name={artist.name}
              country={artist.country}
              debutYear={debutYear}
              trackCount={artist.trackCount}
              releaseCount={artist.releaseCount}
              artistType={artist.artistType}
            />
          )}

          {hasTopSongs && (
            <ArtistTopSongs songs={artist.topSongs} />
          )}

          {hasReleases && (
            <ArtistDiscography releases={artist.releases} artistName={artist.name} />
          )}

          {hasAppearances && (
            <ArtistDiscography
              releases={appearances}
              artistName={artist.name}
              eyebrow="Appears On"
              title="Features & appearances"
              emptyTitle="No appearances"
              emptyDescription="No appearances match the selected filter."
            />
          )}

          {hasVideos && (
            <ArtistVideos videos={artist.videos} />
          )}

          {hasChartEntries && (
            <ArtistChartSection entries={artist.chartEntries} />
          )}
        </div>

        {hasRelated && (
          <div className="mt-14">
            <RelatedArtistsShelf artists={artist.relatedArtists} />
          </div>
        )}
      </div>

      {/* ── Share bottom sheet ── */}
      {showShareSheet && (
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowShareSheet(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl bg-[var(--wk-surface)] p-6 shadow-2xl">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--wk-border)]" />
            <h3 className="mb-5 text-[17px] font-black text-[var(--wk-text)]">Share artist</h3>
            <button
              onClick={handleShare}
              className="flex w-full items-center gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-4 text-left transition-colors active:bg-[var(--wk-surface-raised)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]">
                <i className={`${copied ? "ri-check-line" : "ri-clipboard-line"} text-[var(--wk-brand)] text-lg`} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[var(--wk-text)]">{copied ? "Link copied!" : "Copy link"}</div>
                <div className="text-[12px] text-[var(--wk-text-muted)]">{window.location.href}</div>
              </div>
            </button>
            <button
              onClick={() => setShowShareSheet(false)}
              className="mt-3 w-full rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] py-4 text-[14px] font-bold text-[var(--wk-text-muted)] transition-colors active:bg-[var(--wk-surface-raised)]"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
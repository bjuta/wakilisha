import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { getArtist, type RepairedArtistDetail } from "@/services/repairedContent/client";
import { ArtistDetailHero } from "./components/ArtistDetailHero";
import { ArtistStatsBar } from "./components/ArtistStatsBar";
import { ArtistChartSection } from "./components/ArtistChartSection";
import { ArtistDiscography } from "./components/ArtistDiscography";
import { RelatedArtistsShelf } from "./components/RelatedArtistsShelf";
import { ArtistTopSongs } from "./components/ArtistTopSongs";
import { ArtistBioSection } from "./components/ArtistBioSection";
import { ArtistVideos } from "./components/ArtistVideos";

export default function ArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [artist, setArtist] = useState<RepairedArtistDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) {
      setStatus("error");
      setError("No artist slug provided");
      return;
    }
    setStatus("loading");
    setError(null);
    getArtist(slug)
      .then((data) => {
        if (!alive) return;
        if (!data) {
          setStatus("error");
          setError("Artist not found in the registry.");
          return;
        }
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

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center">
          <i className="ri-user-line mb-4 block text-5xl text-[var(--wk-text-faint)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Loading artist…</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !artist) {
    return (
      <div className="wk-container px-6 py-20 text-center">
        <i className="ri-user-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Artist not found</h1>
        <p className="text-[var(--wk-text-muted)]">{error || "This artist does not exist in the registry."}</p>
        <Link to="/artists" className="mt-6 inline-block">
          <WkButton variant="primary">Back to directory</WkButton>
        </Link>
      </div>
    );
  }

  // Compute debut year from earliest release
  const releaseYears = artist.releases
    .map((r) => (r.releaseDate ? parseInt(r.releaseDate.split("-")[0], 10) : 0))
    .filter((y) => y > 0);
  const debutYear = releaseYears.length > 0 ? Math.min(...releaseYears) : new Date().getFullYear();

  const stats = [
    { label: "Tracks", value: artist.trackCount, icon: "ri-music-2-line" },
    { label: "Releases", value: artist.releaseCount, icon: "ri-album-line" },
    { label: "Followers", value: artist.followerCount > 0 ? (artist.followerCount / 1000).toFixed(1) : "—", suffix: artist.followerCount > 0 ? "K" : "", icon: "ri-user-follow-line" },
    { label: "Peak chart", value: artist.isChartArtist ? `#${artist.topChartPosition}` : "—", icon: "ri-bar-chart-line" },
  ];

  const hasChartEntries = artist.chartEntries.length > 0;
  const hasReleases = artist.releases.length > 0;
  const hasRelated = artist.relatedArtists.length > 0;
  const hasTopSongs = artist.topSongs.length > 0;
  const hasBio = artist.bio || artist.fullBio;
  const hasVideos = artist.videos && artist.videos.length > 0;

  return (
    <div className="wk-app-shell">
      {/* Hero */}
      <ArtistDetailHero
        name={artist.name}
        imageUrl={artist.imageUrl}
        profileImageUrl={artist.profileImageUrl || artist.imageUrl}
        genres={artist.genres}
        country={artist.country}
        debutYear={debutYear}
        followerCount={artist.followerCount}
        trackCount={artist.trackCount}
        releaseCount={artist.releaseCount}
        isChartArtist={artist.isChartArtist}
        topChartPosition={artist.topChartPosition ?? undefined}
        bio={artist.bio}
        isRising={artist.isRising}
        spotifyUrl={artist.spotifyUrl}
        artistType={artist.artistType}
      />

      {/* Floating Stats Ribbon */}
      <ArtistStatsBar stats={stats} />

      {/* Main Content — full width */}
      <div className="wk-container px-6 py-10 md:py-14">
        <div className="space-y-14 md:space-y-16 max-w-5xl">
          {/* Bio */}
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

          {/* Top Songs */}
          {hasTopSongs && (
            <ArtistTopSongs songs={artist.topSongs} />
          )}

          {/* Discography */}
          {hasReleases && (
            <ArtistDiscography releases={artist.releases} />
          )}

          {/* Videos */}
          {hasVideos && (
            <ArtistVideos videos={artist.videos} />
          )}

          {/* Chart Entries */}
          {hasChartEntries && (
            <ArtistChartSection entries={artist.chartEntries} />
          )}
        </div>

        {/* Related Artists — full width below */}
        {hasRelated && (
          <div className="mt-14 md:mt-16">
            <RelatedArtistsShelf artists={artist.relatedArtists} />
          </div>
        )}
      </div>
    </div>
  );
}
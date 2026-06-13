import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { getArtist, getArtistDiscographyFromRegistry, getArtistStandaloneTracks, type RepairedArtistDetail, type RegistryDiscographyRelease, type RegistryStandaloneTrack } from "@/services/repairedContent/client";
import { ArtistDetailHero } from "./components/ArtistDetailHero";
import { ArtistChartSection } from "./components/ArtistChartSection";
import { ArtistDiscography } from "./components/ArtistDiscography";
import { RelatedArtistsShelf } from "./components/RelatedArtistsShelf";
import { ArtistTopSongs } from "./components/ArtistTopSongs";
import { ArtistBioSection } from "./components/ArtistBioSection";
import { ArtistVideos } from "./components/ArtistVideos";

function mergeDiscography(
  apiReleases: RepairedArtistDetail["releases"],
  registryReleases: RegistryDiscographyRelease[]
): RepairedArtistDetail["releases"] {
  const safeApiReleases = apiReleases || [];

  // Registry is authoritative. First add all registry releases.
  const merged: RepairedArtistDetail["releases"] = registryReleases.map((rr) => ({
    slug: rr.slug,
    title: rr.title,
    releaseType: rr.releaseType,
    year: rr.year,
    releaseDate: rr.releaseDate,
    trackCount: rr.trackCount,
    artworkUrl: rr.artworkUrl,
    tracks: rr.tracks,
  }));

  // Track titles we already have (case-insensitive) so we don't add API duplicates
  const seenTitles = new Set(registryReleases.map((r) => r.title.toLowerCase().trim()));
  const seenSlugs = new Set(registryReleases.map((r) => r.slug));

  // Only add API releases that are genuinely new (not duplicates by title or slug)
  for (const apiRel of safeApiReleases) {
    const titleKey = (apiRel.title || "").toLowerCase().trim();
    if (seenTitles.has(titleKey) || seenSlugs.has(apiRel.slug)) continue;
    seenTitles.add(titleKey);
    seenSlugs.add(apiRel.slug);
    merged.push(apiRel);
  }

  return merged;
}

function mergeTopSongs(
  apiSongs: RepairedArtistDetail["topSongs"],
  standaloneTracks: RegistryStandaloneTrack[]
): RepairedArtistDetail["topSongs"] {
  const safeApiSongs = apiSongs || [];
  if (!standaloneTracks.length) return safeApiSongs;

  const existingTitles = new Set(safeApiSongs.map((s) => s.title.toLowerCase()));

  const newSongs = standaloneTracks
    .filter((st) => !existingTitles.has(st.title.toLowerCase()))
    .map((st) => ({
      title: st.title,
      artists: st.artists,
      image: st.image,
      duration: st.duration,
      songUrl: st.songUrl,
    }));

  return [...safeApiSongs, ...newSongs];
}

function buildSinglesRelease(standaloneTracks: RegistryStandaloneTrack[], artistSlug: string): RegistryDiscographyRelease | null {
  if (!standaloneTracks.length) return null;

  return {
    slug: `${artistSlug}-singles`,
    title: "Singles",
    releaseType: "single",
    year: "",
    releaseDate: "",
    trackCount: standaloneTracks.length,
    artworkUrl: standaloneTracks[0]?.image || "",
    tracks: standaloneTracks.map((st) => ({
      title: st.title,
      duration: st.duration,
    })),
  };
}

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

    Promise.all([
      getArtist(slug),
      getArtistDiscographyFromRegistry(slug).catch(() => [] as RegistryDiscographyRelease[]),
      getArtistStandaloneTracks(slug).catch(() => [] as RegistryStandaloneTrack[]),
    ])
      .then(([data, registryDiscography, standaloneTracks]) => {
        if (!alive) return;
        if (!data) {
          setStatus("error");
          setError("Artist not found in the registry.");
          return;
        }
        // Registry is the lord — merge its discography as authoritative
        if (registryDiscography.length > 0) {
          data.releases = mergeDiscography(data.releases, registryDiscography);
        }

        // Merge standalone tracks into top songs
        if (standaloneTracks.length > 0) {
          data.topSongs = mergeTopSongs(data.topSongs, standaloneTracks);
        }

        // Add standalone tracks as a "Singles" pseudo-release in discography
        if (standaloneTracks.length > 0) {
          const singlesRelease = buildSinglesRelease(standaloneTracks, slug);
          if (singlesRelease) {
            data.releases = [...data.releases, {
              slug: singlesRelease.slug,
              title: singlesRelease.title,
              releaseType: singlesRelease.releaseType,
              year: singlesRelease.year,
              releaseDate: singlesRelease.releaseDate,
              trackCount: singlesRelease.trackCount,
              artworkUrl: singlesRelease.artworkUrl,
              tracks: singlesRelease.tracks,
            }];
          }
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

  const hasChartEntries = artist.chartEntries.length > 0;
  const appearances = Array.isArray((artist as any).appearances) ? (artist as any).appearances : [];
  const hasReleases = artist.releases.length > 0;
  const hasAppearances = appearances.length > 0;
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
        bio={artist.bio}
        isRising={artist.isRising}
        spotifyUrl={artist.spotifyUrl}
        artistType={artist.artistType}
      />



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

          {/* Appears On */}
          {hasAppearances && (
            <ArtistDiscography
              releases={appearances}
              eyebrow="Appears On"
              title="Features & appearances"
              emptyTitle="No appearances"
              emptyDescription="No appearances match the selected filter."
            />
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
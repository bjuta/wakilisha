import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { MetaTags } from "@/components/seo/MetaTags";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import type { MusicGroupSchema } from "@/components/seo/SchemaOrg";
import { getArtist, getArtistAppearsOn, clearDiscographyCache, type PublicArtistDetail, type RegistryAppearsOnRelease } from "@/services/publicContent/client";
import { supabase } from "@/lib/supabase";
import { ArtistDetailHero } from "./components/ArtistDetailHero";
import { ArtistChartSection } from "./components/ArtistChartSection";
import { ArtistDiscography } from "./components/ArtistDiscography";
import { RelatedArtistsShelf } from "./components/RelatedArtistsShelf";
import { ArtistTopSongs } from "./components/ArtistTopSongs";
import { ArtistBioSection, cleanBioExcerpt } from "./components/ArtistBioSection";
import { ArtistVideos } from "./components/ArtistVideos";
import { ArtistNewsletterSection } from "./components/ArtistNewsletterSection";
import { ArtistTaggedArticles } from "./components/ArtistTaggedArticles";
import { ContributionBadges } from "@/components/feature/community/ContributionBadges";
import { CommunitySection } from "@/pages/magazine/article/components/CommunitySection";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";

async function getArtistRegisteredGenres(slug: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("registry_artists")
    .select("metadata")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return [];

  const metadata = (data.metadata || {}) as Record<string, unknown>;
  const genres = Array.isArray(metadata.genres) ? metadata.genres : [];
  return genres.map(String).filter(Boolean);
}

export default function ArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthUser();

  useScrollDepthTracking({
    pageType: "artist_detail",
    entitySlug: slug,
    entityType: "artist",
  });

  const [artist, setArtist] = useState<PublicArtistDetail | null>(null);
  const [registeredGenres, setRegisteredGenres] = useState<string[]>([]);
  const [appearsOn, setAppearsOn] = useState<RegistryAppearsOnRelease[]>([]);
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

    clearDiscographyCache(slug);

    Promise.all([
      getArtist(slug),
      getArtistAppearsOn(slug).catch(() => [] as RegistryAppearsOnRelease[]),
      getArtistRegisteredGenres(slug),
    ])
      .then(([data, registryAppearsOn, genres]) => {
        if (!alive) return;
        if (!data) {
          setStatus("error");
          setError("Artist not found.");
          return;
        }

        setAppearsOn(registryAppearsOn);
        setArtist(data);
        setRegisteredGenres(genres);
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
        <p className="text-[var(--wk-text-muted)]">{error || "This artist could not be found."}</p>
        <Link to="/artists" className="mt-6 inline-block">
          <WkButton variant="primary">Back to directory</WkButton>
        </Link>
      </div>
    );
  }

  const releaseYears = artist.releases
    .map((r) => (r.releaseDate ? parseInt(r.releaseDate.split("-")[0], 10) : 0))
    .filter((y) => y > 0);
  const debutYear = releaseYears.length > 0 ? Math.min(...releaseYears) : new Date().getFullYear();

  const hasChartEntries = artist.chartEntries.length > 0;
  const hasAppearsOn = appearsOn.length > 0;
  const hasReleases = artist.releases.length > 0;
  const hasRelated = artist.relatedArtists.length > 0;
  const hasTopSongs = artist.topSongs.length > 0;
  const hasBio = artist.bio || artist.fullBio;
  const hasVideos = artist.videos && artist.videos.length > 0;
  const heroBio = cleanBioExcerpt(artist.fullBio || artist.bio || "");
  const bioForSeo = cleanBioExcerpt(artist.fullBio || artist.bio || "");
  const seoDescription = bioForSeo || `Explore ${artist.name} on WAKILISHA — songs, releases, chart moments, and more.`;

  const communityEntity = {
    type: "artist" as const,
    id: artist.id,
    slug: artist.slug,
    url: typeof window !== "undefined" ? window.location.href : `/artists/${artist.slug}`,
    title: artist.name,
    imageUrl: artist.profileImageUrl || artist.imageUrl,
  };

  return (
    <div className="wk-app-shell">
      <MetaTags
        title={`${artist.name} on WAKILISHA`}
        description={seoDescription}
        imageUrl={artist.profileImageUrl || artist.imageUrl}
        type="website"
      />

      <SchemaOrg
        data={{
          "@type": "MusicGroup",
          name: artist.name,
          image: artist.profileImageUrl || artist.imageUrl,
          description: bioForSeo,
          genre: registeredGenres,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          sameAs: artist.spotifyUrl ? [artist.spotifyUrl] : undefined,
        }}
      />

      <ArtistDetailHero
        name={artist.name}
        artistId={artist.id}
        slug={artist.slug}
        userId={!user.loading ? user.id : undefined}
        imageUrl={artist.imageUrl}
        profileImageUrl={artist.profileImageUrl || artist.imageUrl}
        bio={heroBio}
        isRising={artist.isRising}
        spotifyUrl={artist.spotifyUrl}
        artistType={artist.artistType}
        country={artist.country}
        genres={registeredGenres}
        trackCount={artist.trackCount}
        releaseCount={artist.releaseCount}
        chartEntryCount={artist.chartEntries.length}
      />

      <div className="wk-container px-6 pb-4">
        <ContributionBadges entityType="artist" entitySlug={artist.slug} />
      </div>

      <div className="wk-container px-6 py-10 md:py-14">
        <div className="space-y-14 md:space-y-16 max-w-5xl">
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
            <ArtistTopSongs songs={artist.topSongs} artistSlug={artist.slug} />
          )}

          {hasReleases && (
            <ArtistDiscography
              releases={artist.releases}
              artistName={artist.name}
              eyebrow="Discography"
              title="Releases"
              emptyTitle="No releases"
              emptyDescription="No releases match the selected filter."
            />
          )}

          {hasAppearsOn && (
            <ArtistDiscography
              releases={appearsOn}
              artistName={artist.name}
              eyebrow="Appears On"
              title="Features & appearances"
              emptyTitle="No appearances"
              emptyDescription="No appearances match the selected filter."
            />
          )}

          {hasVideos && (
            <ArtistVideos videos={artist.videos} artistSlug={artist.slug} />
          )}

          <ArtistNewsletterSection artistName={artist.name} artistSlug={artist.slug} />

          <ArtistTaggedArticles artistName={artist.name} artistSlug={artist.slug} />

          {hasChartEntries && (
            <ArtistChartSection entries={artist.chartEntries} artistSlug={artist.slug} />
          )}
        </div>

        {hasRelated && (
          <div className="mt-14 md:mt-16">
            <RelatedArtistsShelf artists={artist.relatedArtists} />
          </div>
        )}
      </div>

      <CommunitySection entity={communityEntity} user={user} />
    </div>
  );
}
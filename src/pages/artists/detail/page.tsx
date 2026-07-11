import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { MetaTags } from "@/components/seo/MetaTags";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import type { MusicGroupSchema } from "@/components/seo/SchemaOrg";
import { getArtist, getArtistAppearsOn, clearDiscographyCache, type PublicArtistDetail, type RegistryAppearsOnRelease } from "@/services/publicContent/client";
import { getPublicArtistRelationships, type PublicArtistRelationship } from "@/services/publicArtistRelationships";
import { supabase } from "@/lib/supabase";
import { ArtistDetailHero } from "./components/ArtistDetailHero";
import { ArtistChartSection } from "./components/ArtistChartSection";
import { ArtistDiscography } from "./components/ArtistDiscography";
import { RelatedArtistsShelf, type ArtistConnection } from "./components/RelatedArtistsShelf";
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

function buildArtistConnections(
  relatedArtists: PublicArtistDetail["relatedArtists"],
  relationships: PublicArtistRelationship[],
): ArtistConnection[] {
  const bySlug = new Map<string, ArtistConnection>();

  relatedArtists.forEach((artist) => {
    bySlug.set(artist.slug, { ...artist });
  });

  relationships
    .filter((relationship) => relationship.relatedEntityType === "artist")
    .forEach((relationship) => {
      const existing = bySlug.get(relationship.relatedEntitySlug);
      bySlug.set(relationship.relatedEntitySlug, {
        ...(existing || {
          slug: relationship.relatedEntitySlug,
          name: relationship.relatedEntityName,
          imageUrl: relationship.relatedEntityImageUrl || undefined,
        }),
        name: relationship.relatedEntityName,
        imageUrl: existing?.imageUrl || relationship.relatedEntityImageUrl || undefined,
        reviewed: true,
        reviewedReason: relationship.plainReason,
        evidenceCount: relationship.evidenceCount,
        relationshipLabel: relationship.relationshipRole || relationship.relationshipType,
      });
    });

  return Array.from(bySlug.values()).sort((left, right) => {
    if (Boolean(left.reviewed) !== Boolean(right.reviewed)) return left.reviewed ? -1 : 1;
    const leftStrength = left.sharedTracksAll || left.score || 0;
    const rightStrength = right.sharedTracksAll || right.score || 0;
    if (leftStrength !== rightStrength) return rightStrength - leftStrength;
    return left.name.localeCompare(right.name);
  });
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
  const [relationships, setRelationships] = useState<PublicArtistRelationship[]>([]);
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

  useEffect(() => {
    let alive = true;
    if (!artist?.id) {
      setRelationships([]);
      return;
    }

    getPublicArtistRelationships(artist.id)
      .then((items) => {
        if (alive) setRelationships(items);
      })
      .catch(() => {
        if (alive) setRelationships([]);
      });

    return () => { alive = false; };
  }, [artist?.id]);

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
        <p className="text-[var(--wk-text-muted)]">{error ? "We couldn't load this artist. Try again in a moment." : "This artist could not be found."}</p>
        <Link to="/artists" className="mt-6 inline-block">
          <WkButton variant="primary">Back to artists</WkButton>
        </Link>
      </div>
    );
  }

  const datedReleases = artist.releases
    .map((release) => release.releaseDate || release.year || "")
    .filter((value) => /\d{4}/.test(value))
    .sort((a, b) => a.localeCompare(b));

  const oldestReleaseLabel = datedReleases[0]
    ? new Date(datedReleases[0]).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: datedReleases[0].length > 4 ? "numeric" : undefined,
      })
    : "";

  const artistConnections = buildArtistConnections(artist.relatedArtists, relationships);
  const hasChartEntries = artist.chartEntries.length > 0;
  const hasAppearsOn = appearsOn.length > 0;
  const hasReleases = artist.releases.length > 0;
  const hasConnections = artistConnections.length > 0;
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
        } satisfies MusicGroupSchema}
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
              oldestReleaseLabel={oldestReleaseLabel}
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
              emptyDescription="Nothing here for this filter yet. Try another one."
            />
          )}

          {hasAppearsOn && (
            <ArtistDiscography
              releases={appearsOn}
              artistName={artist.name}
              eyebrow="Appears On"
              title="Features & appearances"
              emptyTitle="No appearances"
              emptyDescription="Nothing here for this filter yet. Try another one."
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

        {hasConnections && (
          <div className="mt-14 md:mt-16">
            <RelatedArtistsShelf artists={artistConnections} />
          </div>
        )}
      </div>

      <CommunitySection entity={communityEntity} user={user} />
    </div>
  );
}

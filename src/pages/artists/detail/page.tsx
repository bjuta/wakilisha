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
import { ArtistAuthorityPanel } from "./components/ArtistAuthorityPanel";
import { ArtistPostsTimeline } from "./components/ArtistPostsTimeline";
import { getArtistPublicPresentation, type ArtistPublicAuthority } from "@/services/artists/claimedArtist";
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

type ArtistProfileTab =
  | "posts"
  | "music"
  | "about"
  | "community";

const ARTIST_PROFILE_TABS: Array<{
  id: ArtistProfileTab;
  label: string;
}> = [
  {
    id: "posts",
    label: "Posts",
  },
  {
    id: "music",
    label: "Music",
  },
  {
    id: "about",
    label: "About",
  },
  {
    id: "community",
    label: "Community",
  },
];

function ArtistProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: ArtistProfileTab;
  onChange: (
    tab: ArtistProfileTab,
  ) => void;
}) {
  return (
    <div className="overflow-x-auto border-t border-[var(--wk-divider)]">
      <div
        role="tablist"
        aria-label="Artist profile sections"
        className="flex min-w-max items-center gap-7 pt-4 sm:gap-9"
      >
        {ARTIST_PROFILE_TABS.map(
          (tab) => {
            const active =
              tab.id === activeTab;

            return (
              <button
                key={tab.id}
                id={`artist-profile-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`artist-profile-panel-${tab.id}`}
                onClick={() =>
                  onChange(tab.id)
                }
                className={`relative pb-4 text-[13px] font-black transition-colors ${
                  active
                    ? "text-[var(--wk-text)]"
                    : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                }`}
              >
                {tab.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-opacity ${
                    active
                      ? "bg-[var(--wk-brand)] opacity-100"
                      : "opacity-0"
                  }`}
                />
              </button>
            );
          },
        )}
      </div>
    </div>
  );
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
  const [artistAuthority, setArtistAuthority] = useState<ArtistPublicAuthority | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [postsRevision, setPostsRevision] = useState(0);
  const [activeTab, setActiveTab] =
    useState<ArtistProfileTab>("posts");

  useEffect(() => {
    setActiveTab("posts");
  }, [slug]);

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

  useEffect(() => {
    let alive = true;
    if (!artist?.id) {
      setArtistAuthority(null);
      return;
    }

    getArtistPublicPresentation(artist.id)
      .then((authority) => {
        if (alive) setArtistAuthority(authority);
      })
      .catch(() => {
        if (alive) setArtistAuthority(null);
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
        <h1 className="wk-h-section mb-2">Artist Not Found</h1>
        <p className="text-[var(--wk-text-muted)]">{error ? "We couldn't load this artist. Try again in a moment." : "This artist could not be found."}</p>
        <Link to="/artists" className="mt-6 inline-block">
          <WkButton variant="primary">Back to Artists</WkButton>
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
  const reviewedPopularTracks = relationships.filter(
    (relationship) =>
      relationship.relatedEntityType === "track" &&
      relationship.relationshipType === "popular_track",
  );
  const hasChartEntries = artist.chartEntries.length > 0;
  const hasAppearsOn = appearsOn.length > 0;
  const hasReleases = artist.releases.length > 0;
  const hasConnections = artistConnections.length > 0;
  const hasTopSongs = artist.topSongs.length > 0;
  const presentedBio = artistAuthority?.presentation?.bio?.trim() || "";
  const displayBio = presentedBio || artist.bio || "";
  const displayFullBio = presentedBio || artist.fullBio || artist.bio || "";
  const displayProfileImage = artistAuthority?.presentation?.profileImageUrl || artist.profileImageUrl || artist.imageUrl;
  const displayHeroImage = artistAuthority?.presentation?.heroImageUrl || artist.imageUrl;
  const hasBio = Boolean(displayBio || displayFullBio);
  const hasVideos = artist.videos && artist.videos.length > 0;
  const hasMusicContent =
    hasTopSongs ||
    hasReleases ||
    hasAppearsOn ||
    hasVideos ||
    hasChartEntries;
  const heroBio = cleanBioExcerpt(displayFullBio || displayBio);
  const bioForSeo = cleanBioExcerpt(displayFullBio || displayBio);
  const seoDescription = bioForSeo || `Explore ${artist.name} on WAKILISHA: songs, releases, chart moments, and more.`;

  const communityEntity = {
    type: "artist" as const,
    id: artist.id,
    slug: artist.slug,
    url: typeof window !== "undefined" ? window.location.href : `/artists/${artist.slug}`,
    title: artist.name,
    imageUrl: displayProfileImage,
  };

  return (
    <div className="wk-app-shell">
      <MetaTags
        title={`${artist.name} on WAKILISHA`}
        description={seoDescription}
        imageUrl={displayProfileImage}
        type="website"
      />

      <SchemaOrg
        data={{
          "@type": "MusicGroup",
          name: artist.name,
          image: displayProfileImage,
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
        imageUrl={displayHeroImage}
        profileImageUrl={displayProfileImage}
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

      <ArtistAuthorityPanel
        artistId={artist.id}
        artistSlug={artist.slug}
        artistName={artist.name}
        authority={artistAuthority}
        userId={!user.loading ? user.id || undefined : undefined}
        authLoading={user.loading}
        navigation={
          <ArtistProfileTabs
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        }
        showComposer={
          activeTab === "posts"
        }
        onPostSaved={() =>
          setPostsRevision(
            (current) => current + 1,
          )
        }
      />

      <div
        id={`artist-profile-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`artist-profile-tab-${activeTab}`}
      >
        {activeTab === "posts" && (
          <>
            <ArtistPostsTimeline
              artistId={artist.id}
              artistName={artist.name}
              artistImageUrl={displayProfileImage}
              revision={postsRevision}
            />

            <div className="wk-container px-6 pb-12 pt-2 md:pb-16">
              <div className="max-w-5xl">
                <ArtistNewsletterSection
                  artistName={artist.name}
                  artistSlug={artist.slug}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === "music" && (
          <div className="wk-container px-6 py-10 md:py-14">
            <div className="max-w-5xl space-y-14 md:space-y-16">
              {!hasMusicContent && (
                <div className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-12 text-center sm:px-10">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                    <i
                      className="ri-music-2-line text-[21px]"
                      aria-hidden="true"
                    />
                  </div>
                  <h2 className="mt-5 text-[20px] font-black tracking-[-0.025em] text-[var(--wk-text)]">
                    No Music Here Yet
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[var(--wk-text-muted)]">
                    Music connected to {artist.name} on WAKILISHA will appear here.
                  </p>
                </div>
              )}

              {hasTopSongs && (
                <ArtistTopSongs
                  songs={artist.topSongs}
                  artistSlug={artist.slug}
                  reviewedRelationships={reviewedPopularTracks}
                />
              )}

              {hasReleases && (
                <ArtistDiscography
                  releases={artist.releases}
                  artistName={artist.name}
                  eyebrow="Discography"
                  title="Releases"
                  emptyTitle="No Releases"
                  emptyDescription="There are no releases to show here yet."
                />
              )}

              {hasAppearsOn && (
                <ArtistDiscography
                  releases={appearsOn}
                  artistName={artist.name}
                  eyebrow="Appears On"
                  title="Features & Appearances"
                  emptyTitle="No Appearances"
                  emptyDescription="There are no appearances to show here yet."
                />
              )}

              {hasVideos && (
                <ArtistVideos
                  videos={artist.videos}
                  artistSlug={artist.slug}
                />
              )}

              {hasChartEntries && (
                <ArtistChartSection
                  entries={artist.chartEntries}
                  artistSlug={artist.slug}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div className="wk-container px-6 py-10 md:py-14">
            <div className="max-w-5xl space-y-14 md:space-y-16">
              <ContributionBadges
                entityType="artist"
                entitySlug={artist.slug}
              />

              {hasBio ? (
                <ArtistBioSection
                  bio={displayBio}
                  fullBio={displayFullBio}
                  name={artist.name}
                  country={artist.country}
                  oldestReleaseLabel={oldestReleaseLabel}
                  trackCount={artist.trackCount}
                  releaseCount={artist.releaseCount}
                  artistType={artist.artistType}
                />
              ) : (
                <div className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-10">
                  <h2 className="text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
                    About {artist.name}
                  </h2>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                    There is no biography here yet.
                  </p>
                </div>
              )}

              <ArtistTaggedArticles
                artistName={artist.name}
                artistSlug={artist.slug}
              />
            </div>

            {hasConnections && (
              <div className="mt-14 md:mt-16">
                <RelatedArtistsShelf
                  artists={artistConnections}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "community" && (
          <CommunitySection
            entity={communityEntity}
            user={user}
          />
        )}
      </div>
    </div>
  );
}

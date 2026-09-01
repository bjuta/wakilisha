import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";
import { useAuthUser } from "@/hooks/useAuthUser";
import { usePlayer } from "@/context/PlayerContext";
import { trackEvent } from "@/services/analytics";
import {
  getReleaseTrack,
  getTrack,
} from "@/services/publicApi/client";
import { resolveScopedSlugRedirect } from "@/services/slugRedirects";
import {
  parseLyricsEditorText,
  submitTrackLyricsContribution,
} from "@/services/player/trackLyricsService";
import {
  canonicalTrackUrl,
} from "@/utils/trackUrl";

interface TrackData {
  registryTrackId: string;
  slug: string;
  title: string;
  artist: string;
  artistSlug: string;
  artworkUrl: string;
  duration: number;
  isPlayable: boolean;
  previewUrl: string | null;
  releaseSlug?: string;
  releaseTrackCount?: number;
}

export default function LyricContribution() {
  const {
    artistSlug,
    releaseSlug,
    trackSlug,
  } = useParams<{
    artistSlug: string;
    releaseSlug?: string;
    trackSlug: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useAuthUser();
  const {
    playTrack,
    currentTrack,
    isPlaying,
    togglePlay,
  } = usePlayer();

  const [track, setTrack] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lyricsText, setLyricsText] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let alive = true;

    if (!artistSlug || !trackSlug) {
      setLoading(false);
      setError("Invalid Track URL.");
      return;
    }

    const activeTrackSlug =
      currentTrack?.trackSlug || currentTrack?.id || "";
    const activeArtistSlug =
      currentTrack?.artistSlug || "";

    if (
      currentTrack?.registryTrackId &&
      activeTrackSlug === trackSlug &&
      (!activeArtistSlug || activeArtistSlug === artistSlug)
    ) {
      setTrack({
        registryTrackId: currentTrack.registryTrackId,
        slug: activeTrackSlug,
        title: currentTrack.title,
        artist: currentTrack.artist,
        artistSlug: activeArtistSlug || artistSlug,
        artworkUrl: currentTrack.artworkUrl || "",
        duration: Number(currentTrack.duration || 0),
        isPlayable: currentTrack.isPlayable !== false,
        previewUrl: currentTrack.previewUrl || null,
      });
      setLoading(false);
      setError(null);
      return;
    }

    const requestedRegistryTrackId =
      new URLSearchParams(location.search)
        .get("track_id")
        ?.trim() || "";

    if (requestedRegistryTrackId) {
      setLoading(true);
      setError(null);

      Promise.all([
        supabase.rpc(
          "get_tracks_by_ids",
          {
            p_track_ids: [
              requestedRegistryTrackId,
            ],
          },
        ),
        supabase.rpc(
          "registry_resolve_artist_slug_for_public",
          {
            p_slug: artistSlug,
          },
        ),
      ])
        .then(
          ([
            trackResult,
            artistResult,
          ]) => {
            if (!alive) return;

            if (trackResult.error) {
              throw trackResult.error;
            }

            const trackRows =
              Array.isArray(trackResult.data)
                ? trackResult.data
                : [];
            const resolvedTrack =
              trackRows[0] || null;

            if (
              !resolvedTrack ||
              resolvedTrack.slug !== trackSlug
            ) {
              setLoading(false);
              setError("Track not found.");
              return;
            }

            const artistRows =
              Array.isArray(artistResult.data)
                ? artistResult.data
                : [];
            const resolvedArtist =
              artistRows[0] || null;
            const artistName =
              resolvedArtist?.canonical_display_name ||
              artistSlug
                .split("-")
                .filter(Boolean)
                .map(
                  (part) =>
                    `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
                )
                .join(" ");

            setTrack({
              registryTrackId:
                resolvedTrack.id,
              slug:
                resolvedTrack.slug,
              title:
                resolvedTrack.title,
              artist:
                artistName ||
                "WAKILISHA",
              artistSlug:
                resolvedArtist?.canonical_slug ||
                artistSlug,
              artworkUrl:
                resolvedTrack.artwork_url ||
                "",
              duration:
                resolvedTrack.duration_ms
                  ? Math.round(
                      resolvedTrack.duration_ms /
                        1000,
                    )
                  : 0,
              isPlayable:
                false,
              previewUrl:
                null,
            });
            setLoading(false);
          },
        )
        .catch(() => {
          if (!alive) return;
          setLoading(false);
          setError("Could not load Track.");
        });

      return () => {
        alive = false;
      };
    }


    setLoading(true);
    setError(null);

    const request = releaseSlug
      ? getReleaseTrack(artistSlug, releaseSlug, trackSlug)
      : getTrack(artistSlug, trackSlug);

    request
      .then(async (apiData) => {
        if (!alive) return;

        if (!apiData) {
          const redirect = await resolveScopedSlugRedirect(
            "track",
            artistSlug,
            trackSlug,
            { releaseSlug },
          );

          if (!alive) return;

          const redirectedLyricsPath = redirect
            ? `${redirect.newPath}/lyrics/contribute`
            : "";

          if (
            redirectedLyricsPath &&
            redirectedLyricsPath !== location.pathname
          ) {
            navigate(
              `${redirectedLyricsPath}${location.search || ""}${location.hash || ""}`,
              { replace: true },
            );
            return;
          }

          setLoading(false);
          setError("Track not found.");
          return;
        }

        const raw = apiData as any;
        const trackData = raw.track ?? raw;
        const artistData = raw.artist ?? {};
        const rawArtists = Array.isArray(raw.artists) ? raw.artists : [];
        const primaryArtist =
          rawArtists.find((artist: any) => artist.isPrimary) ||
          rawArtists[0] ||
          artistData;
        const registryTrackId = String(
          trackData.id ?? raw.id ?? "",
        ).trim();

        if (!registryTrackId) {
          setLoading(false);
          setError("This Track is missing its Registry identity.");
          return;
        }

        const duration = trackData.durationMs
          ? Math.round(trackData.durationMs / 1000)
          : Number(trackData.duration || 0);
        const previewUrl: string | null =
          raw.previewUrl || trackData.previewUrl || null;

        const resolvedArtistSlug =
          primaryArtist?.slug ||
          artistData?.slug ||
          artistSlug;
        const releaseData =
          raw.release &&
          typeof raw.release === "object"
            ? raw.release
            : null;
        const releaseTrackCount =
          releaseData
            ? Number(
                releaseData.trackCount ??
                releaseData.track_count ??
                0,
              )
            : undefined;
        const resolvedReleaseSlug =
          String(
            releaseData?.slug ||
            releaseSlug ||
            "",
          ).trim();

        if (
          releaseSlug &&
          releaseData &&
          Number(releaseTrackCount || 0) <= 1
        ) {
          const standaloneLyricsPath =
            `${canonicalTrackUrl(
              resolvedArtistSlug,
              trackData.slug,
              resolvedReleaseSlug,
              releaseTrackCount,
            )}/lyrics/contribute`;

          if (
            standaloneLyricsPath !== location.pathname
          ) {
            navigate(
              `${standaloneLyricsPath}${location.search || ""}${location.hash || ""}`,
              { replace: true },
            );
            return;
          }
        }

        setTrack({
          registryTrackId,
          slug: trackData.slug,
          title: trackData.title,
          artist: primaryArtist?.name || artistData?.name || "WAKILISHA",
          artistSlug: resolvedArtistSlug,
          artworkUrl: trackData.artworkUrl || "",
          duration,
          isPlayable: Boolean(previewUrl),
          previewUrl,
          releaseSlug: resolvedReleaseSlug || undefined,
          releaseTrackCount,
        });
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
        setError("Could not load Track.");
      });

    return () => {
      alive = false;
    };
  }, [
    artistSlug,
    releaseSlug,
    trackSlug,
    navigate,
    location.pathname,
    location.search,
    location.hash,
    currentTrack,
  ]);

  const canonicalTrackPath = canonicalTrackUrl(
    track?.artistSlug || artistSlug || "",
    track?.slug || trackSlug || "",
    track?.releaseSlug || releaseSlug || null,
    track?.releaseTrackCount ?? null,
  );

  const isThisTrackPlaying =
    currentTrack?.registryTrackId === track?.registryTrackId &&
    isPlaying;

  const handlePlay = useCallback(() => {
    if (!track || !track.isPlayable) return;

    if (currentTrack?.registryTrackId === track.registryTrackId) {
      togglePlay();
      return;
    }

    const playable = {
      id: track.slug,
      registryTrackId: track.registryTrackId,
      title: track.title,
      artist: track.artist,
      artistSlug: track.artistSlug,
      trackSlug: track.slug,
      artworkUrl: track.artworkUrl,
      isPlayable: true,
      source: "WAKILISHA",
      duration: track.duration,
      previewUrl: track.previewUrl || undefined,
    };

    playTrack(
      playable,
      [playable],
      {
        pageType: "track_detail",
        entitySlug: track.slug,
        entityType: "track",
        sourceSection: "lyrics_contribution",
      },
    );
  }, [currentTrack?.registryTrackId, playTrack, togglePlay, track]);

  const handleSubmit = useCallback(async () => {
    if (!track || submitting) return;

    if (!authUser.id) {
      setSubmitError("Sign in to contribute Lyrics.");
      return;
    }

    let lines: Array<{ text: string }>;
    try {
      lines = parseLyricsEditorText(lyricsText, "plain");
    } catch (submissionError) {
      setSubmitError(
        submissionError instanceof Error
          ? submissionError.message
          : "Add Lyrics before submitting.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      await submitTrackLyricsContribution({
        trackId: track.registryTrackId,
        lines,
        sourceDescription,
      });

      trackEvent("lyrics_contribution", {
        pageType: "track_detail",
        entitySlug: track.slug,
        entityType: "track",
        context: {
          source_section: "lyrics_contribution",
          artist_slug: track.artistSlug,
          track_title: track.title,
          artist_name: track.artist,
          lines_count: lines.length,
          timing_mode: "plain",
          has_source_description: sourceDescription.trim().length > 0,
        },
      });

      setSubmitted(true);
    } catch (submissionError) {
      setSubmitError(
        submissionError instanceof Error
          ? submissionError.message
          : "Lyrics could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [authUser.id, lyricsText, sourceDescription, submitting, track]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" />
          <p className="mt-4 text-sm font-semibold text-[var(--wk-text-muted)]">
            Loading Track…
          </p>
        </div>
      </main>
    );
  }

  if (error || !track) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] px-6 py-24 text-center">
        <WkIcon
          name="FileText"
          size={30}
          className="mx-auto text-[var(--wk-text-faint)]"
        />
        <h1 className="mt-4 text-2xl font-black text-[var(--wk-text)]">
          Lyrics Unavailable
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--wk-text-muted)]">
          {error || "This Track could not be loaded."}
        </p>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <div className="mx-auto max-w-[640px] px-6 py-20 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]">
            <WkIcon name="Check" size={34} className="text-[var(--wk-brand)]" />
          </div>
          <h1 className="mt-6 text-[28px] font-black text-[var(--wk-text)]">
            Lyrics Submitted
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-[var(--wk-text-muted)]">
            Thanks. Your lyrics are in review. They will only appear publicly after WAKILISHA publishes an approved version.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={canonicalTrackPath}
              className="wk-button wk-button-secondary"
            >
              Back To Track
            </Link>
            <button
              type="button"
              onClick={() => {
                setLyricsText("");
                setSourceDescription("");
                setSubmitted(false);
              }}
              className="wk-button wk-button-primary"
            >
              Submit Another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <header className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="mx-auto flex max-w-[900px] items-center gap-4 px-5 py-4 md:px-6">
          <Link
            to={canonicalTrackPath}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
            aria-label="Back To Track"
          >
            <WkIcon name="ArrowLeft" size={18} />
          </Link>

          {track.artworkUrl ? (
            <img
              src={track.artworkUrl}
              alt=""
              className="h-11 w-11 rounded-xl object-cover"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black">{track.title}</div>
            <div className="truncate text-xs text-[var(--wk-text-muted)]">
              {track.artist}
            </div>
          </div>

          {track.isPlayable ? (
            <button
              type="button"
              onClick={handlePlay}
              aria-label={isThisTrackPlaying ? "Pause" : "Play"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)]"
            >
              <WkIcon
                name={isThisTrackPlaying ? "Pause" : "Play"}
                size={17}
                fill="currentColor"
              />
            </button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-5 py-8 md:px-6 md:py-10">
        <div className="mb-7">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-brand)]">
            Lyrics
          </div>
          <h1 className="mt-2 text-[28px] font-black tracking-[-0.03em] md:text-[34px]">
            Contribute Lyrics
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--wk-text-muted)]">
            Paste or type the lyrics below. You do not need to time them.
          </p>
        </div>

        <label className="block text-xs font-black">
          Lyrics
          <textarea
            value={lyricsText}
            onChange={(event) => setLyricsText(event.target.value)}
            rows={18}
            placeholder="Paste lyrics here. Put each lyric line on a new line."
            className="mt-2 w-full resize-y rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4 text-[15px] leading-7 outline-none transition-colors focus:border-[var(--wk-brand)]"
          />
        </label>

        <label className="mt-5 block text-xs font-black">
          Source <span className="font-medium text-[var(--wk-text-faint)]">(Optional)</span>
          <input
            type="text"
            value={sourceDescription}
            onChange={(event) => setSourceDescription(event.target.value)}
            placeholder="Official lyric video, booklet, artist post, or another source"
            className="mt-2 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--wk-brand)]"
          />
        </label>

        {submitError ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-500/5 px-4 py-3 text-sm text-red-600"
          >
            {submitError}
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--wk-divider)] pt-6">
          <span className="text-xs text-[var(--wk-text-muted)]">
            {lyricsText.split(/\r?\n/).filter((line) => line.trim()).length} lines
          </span>

          {authUser.loading ? null : authUser.id ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="wk-button wk-button-primary"
            >
              <WkIcon name="Check" size={15} />
              {submitting ? "Submitting…" : "Submit Lyrics"}
            </button>
          ) : (
            <Link to="/auth" className="wk-button wk-button-primary">
              Sign In To Contribute
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

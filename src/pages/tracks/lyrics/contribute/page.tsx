import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePlayer } from '@/context/PlayerContext';
import { getReleaseTrack, getTrack } from '@/services/publicApi/client';
import { releaseTrackUrl, trackUrl } from '@/utils/trackUrl';
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from '@/services/analytics';
import { WkIcon } from '@/components/design-system/Icon';

interface DraftLine {
  id: string;
  text: string;
  timestampSeconds: number | null;
}

let lineIdCounter = 0;
function nextLineId(): string {
  return `line-${++lineIdCounter}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TrackData {
  slug: string;
  title: string;
  artist: string;
  artistSlug: string;
  artworkUrl: string;
  duration: number;
  isPlayable: boolean;
  previewUrl: string | null;
}

export default function LyricContribution() {
  const { artistSlug, releaseSlug, trackSlug } = useParams<{
    artistSlug: string;
    releaseSlug?: string;
    trackSlug: string;
  }>();
  const { playTrack, currentTrack, isPlaying, togglePlay, currentTime } = usePlayer();
  const [track, setTrack] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<DraftLine[]>([
    { id: nextLineId(), text: '', timestampSeconds: 0 },
    { id: nextLineId(), text: '', timestampSeconds: null },
    { id: nextLineId(), text: '', timestampSeconds: null },
    { id: nextLineId(), text: '', timestampSeconds: null },
  ]);
  const [sourceDescription, setSourceDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Fetch track data
  useEffect(() => {
    let alive = true;
    if (!artistSlug || !trackSlug) {
      setLoading(false);
      setError('Invalid track URL');
      return;
    }

    setLoading(true);
    setError(null);
    const request = releaseSlug
      ? getReleaseTrack(artistSlug, releaseSlug, trackSlug)
      : getTrack(artistSlug, trackSlug);

    request
      .then((apiData) => {
        if (!alive) return;
        if (!apiData) {
          setLoading(false);
          setError('Track not found.');
          return;
        }
        const trackData = apiData.track ?? apiData;
        const artistData = apiData.artist ?? {};
        const rawArtists = Array.isArray(apiData.artists) ? apiData.artists : [];
        const primaryArtist = rawArtists.find((a: any) => a.isPrimary) || rawArtists[0] || artistData;
        const artistName = primaryArtist?.name || artistData?.name || 'Unknown';
        const duration = trackData.durationMs ? Math.round(trackData.durationMs / 1000) : (trackData.duration || 0);
        const previewUrl: string | null = apiData.previewUrl || trackData.previewUrl || null;
        setTrack({
          slug: trackData.slug,
          title: trackData.title,
          artist: artistName,
          artistSlug: primaryArtist?.slug || artistData?.slug || '',
          artworkUrl: trackData.artworkUrl || '',
          duration,
          isPlayable: !!previewUrl,
          previewUrl,
        });
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setLoading(false);
        setError('Could not load track.');
      });
    return () => { alive = false; };
  }, [artistSlug, releaseSlug, trackSlug]);

  const isThisTrackPlaying = currentTrack?.id === trackSlug && isPlaying;

  // Auto-play the track when entering the page
  useEffect(() => {
    if (track && track.isPlayable && currentTrack?.id !== track.slug) {
      playTrack(
        {
          id: track.slug,
          title: track.title,
          artist: track.artist,
          artworkUrl: track.artworkUrl,
          isPlayable: track.isPlayable,
          source: 'WAKILISHA',
          duration: track.duration,
          previewUrl: track.previewUrl || undefined,
        },
        [
          {
            id: track.slug,
            title: track.title,
            artist: track.artist,
            artworkUrl: track.artworkUrl,
            isPlayable: track.isPlayable,
            source: 'WAKILISHA',
            duration: track.duration,
            previewUrl: track.previewUrl || undefined,
          },
        ],
        {
          pageType: "track_detail",
          entitySlug: trackSlug ?? track.slug,
          entityType: "track",
          sourceSection: "contribute_page",
        },
      );
    }
  }, [track, playTrack, currentTrack]);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { id: nextLineId(), text: '', timestampSeconds: null }]);
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((l) => l.id !== lineId);
    });
  }, []);

  const updateLineText = useCallback((lineId: string, text: string) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, text } : l)));
  }, []);

  const stampTimestamp = useCallback((lineId: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, timestampSeconds: Math.round(currentTime * 10) / 10 } : l)),
    );
  }, [currentTime]);

  const handleSubmit = useCallback(() => {
    const filledLines = lines.filter((l) => l.text.trim() && l.timestampSeconds !== null);
    if (filledLines.length < 2) {
      setSubmitError('Add at least 2 timed lines before submitting.');
      return;
    }
    setSubmitError('');

    if (track) {
      trackEvent("lyrics_contribution", {
        pageType: "track_detail",
        entitySlug: trackSlug ?? "",
        entityType: "track",
        context: {
          source_section: "contribute_page",
          artist_slug: artistSlug ?? track.artistSlug,
          track_title: track.title,
          artist_name: track.artist,
          timed_lines_count: filledLines.length,
          total_lines_count: lines.length,
          has_source_description: sourceDescription.trim().length > 0,
        },
      });
    }

    setSubmitted(true);
  }, [lines, track, trackSlug, artistSlug, sourceDescription]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto h-24 w-24 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Loading track&hellip;</p>
        </div>
      </main>
    );
  }

  if (error || !track) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <i className="ri-file-music-line text-[var(--wk-text-faint)] text-[32px]" />
        </div>
        <h1 className="mb-2 text-[28px] font-black text-[var(--wk-text)]">Track not found</h1>
        <p className="mb-8 text-[15px] text-[var(--wk-text-muted)] max-w-[400px] mx-auto">
          {error || 'We do not have this track page ready yet.'}
        </p>
        <Link to="/charts" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-extrabold text-[var(--wk-brand-on)] hover:opacity-90 whitespace-nowrap">
          <i className="ri-bar-chart-2-line" />
          Browse the charts
        </Link>
      </main>
    );
  }

  const canonicalTrackPath = releaseSlug
    ? releaseTrackUrl(artistSlug, releaseSlug, trackSlug)
    : trackUrl(trackSlug, [artistSlug]);

  if (submitted) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <div className="mx-auto max-w-[640px] px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <WkIcon name="Check" size={36} className="text-emerald-500" />
          </div>
          <h1 className="mb-3 text-[28px] font-black text-[var(--wk-text)]">Lyrics submitted!</h1>
          <p className="mb-8 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
            Your timed lyrics for <strong className="text-[var(--wk-text)]">{track.title}</strong> are now pending community review.
            Once more contributors upvote than downvote, they'll go live.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to={canonicalTrackPath} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-3 text-[14px] font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors">Back to track</Link>
            <button onClick={() => setSubmitted(false)} className="rounded-xl bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)] hover:opacity-90 transition-opacity">Submit another</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="mx-auto flex max-w-[900px] items-center gap-4 px-6 py-4">
          <Link to={canonicalTrackPath} className="flex items-center gap-2 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors">
            <WkIcon name="ArrowLeft" size={16} />
            Back
          </Link>
          <div className="h-6 w-px bg-[var(--wk-divider)]" />
          {track.artworkUrl && (
            <img src={track.artworkUrl} alt={track.title} className="h-10 w-10 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-[var(--wk-text)]">{track.title}</div>
            <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{track.artist}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--wk-brand-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand)]">
              {formatTime(currentTime)}
            </span>
            <button
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand)] text-white transition-all hover:opacity-90"
            >
              <WkIcon name={isThisTrackPlaying ? 'Pause' : 'Play'} size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="mx-auto max-w-[720px] px-6 py-8">
        <h1 className="mb-2 text-[24px] font-black text-[var(--wk-text)]">Contribute timed lyrics</h1>
        <p className="mb-8 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
          Play the track and tap <strong className="text-[var(--wk-text)]">Set</strong> on each line
          as it plays to capture the exact timestamp. The community will review and vote on your submission.
        </p>

        {/* Lyric lines */}
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={line.id} className="flex items-start gap-3">
              {/* Timestamp */}
              <button
                onClick={() => stampTimestamp(line.id)}
                className={`flex h-11 w-[72px] flex-shrink-0 items-center justify-center rounded-xl border text-[13px] font-bold transition-all whitespace-nowrap ${
                  line.timestampSeconds !== null
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                    : 'border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]'
                }`}
                title="Click to set timestamp at current playback position"
              >
                {line.timestampSeconds !== null ? formatTime(line.timestampSeconds) : 'Set'}
              </button>

              {/* Text input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={line.text}
                  onChange={(e) => updateLineText(line.id, e.target.value)}
                  placeholder={idx === 0 ? '♪ instrumental intro ♪' : idx === 1 ? 'First line of the song...' : 'Next line...'}
                  className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[14px] text-[var(--wk-text)] placeholder-[var(--wk-text-faint)] outline-none transition-all focus:border-[var(--wk-brand)] focus:ring-1 focus:ring-[var(--wk-brand)]/20"
                />
              </div>

              {/* Remove */}
              {lines.length > 2 && (
                <button
                  onClick={() => removeLine(line.id)}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-transparent text-[var(--wk-text-faint)] transition-all hover:border-red-200 hover:text-red-500"
                  title="Remove line"
                >
                  <WkIcon name="Close" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add line */}
        <button
          onClick={addLine}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--wk-border)] py-3 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
        >
          <WkIcon name="Add" size={16} />
          Add another line
        </button>

        {/* Source description */}
        <div className="mt-6">
          <label className="mb-2 block text-[12px] font-bold text-[var(--wk-text-muted)]">
            Source description <span className="font-normal text-[var(--wk-text-faint)]">(optional)</span>
          </label>
          <input
            type="text"
            value={sourceDescription}
            onChange={(e) => setSourceDescription(e.target.value)}
            placeholder="e.g. Transcribed from official lyric video, From CD booklet, etc."
            className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[14px] text-[var(--wk-text)] placeholder-[var(--wk-text-faint)] outline-none transition-all focus:border-[var(--wk-brand)]"
          />
        </div>

        {/* Error */}
        {submitError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">
            {submitError}
          </div>
        )}

        {/* Submit */}
        <div className="mt-8 flex items-center justify-between border-t border-[var(--wk-divider)] pt-6">
          <div className="text-[12px] text-[var(--wk-text-muted)]">
            {lines.filter((l) => l.text.trim() && l.timestampSeconds !== null).length} timed lines
          </div>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-xl bg-[var(--wk-brand)] px-8 py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90"
          >
            <WkIcon name="Check" size={16} />
            Submit for review
          </button>
        </div>

        {/* Guidelines */}
        <div className="mt-10 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
          <h3 className="mb-3 text-[13px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Guidelines</h3>
          <ul className="space-y-2 text-[13px] text-[var(--wk-text-soft)]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">&#8226;</span>
              Play the track and click <strong>Set</strong> at the exact moment each line begins
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">&#8226;</span>
              Include section markers like <strong>&#8212; Chorus &#8212;</strong> and <strong>&#8212; Verse 2 &#8212;</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">&#8226;</span>
              Mark instrumental sections with <strong>&#9834; instrumental &#9834;</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">&#8226;</span>
              Add a source description so other reviewers can verify accuracy
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">&#8226;</span>
              Your submission goes through community voting. If upvotes exceed downvotes, it goes live.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
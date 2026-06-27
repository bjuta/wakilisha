import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePlayer } from '@/context/PlayerContext';
import { getTrack } from '@/services/publicApi/client';
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from '@/services/analytics';
import { WkIcon } from '@/components/design-system/Icon';

interface DraftLine {
  id: string;
  text: string;
  timestampSeconds: number | null;
}

let lineIdCounter = 0;
function nextLineId(): string {
  return `mline-${++lineIdCounter}`;
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

export default function MobileLyricContribution() {
  const { artistSlug, trackSlug } = useParams<{ artistSlug: string; trackSlug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay, currentTime } = usePlayer();
  const [track, setTrack] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<DraftLine[]>([
    { id: nextLineId(), text: '', timestampSeconds: 0 },
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
    getTrack(artistSlug, trackSlug)
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
        setError(err instanceof Error ? err.message : 'Could not load track.');
      });
    return () => { alive = false; };
  }, [artistSlug, trackSlug]);

  const isThisTrackPlaying = currentTrack?.id === trackSlug && isPlaying;

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
          recordType: "track",
          sourceSection: "contribute_page_mobile",
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
        recordSlug: trackSlug ?? "",
        recordType: "track",
        context: {
          source_section: "contribute_page_mobile",
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
      <div className="wk-mobile-v5 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[13px] font-semibold text-[var(--wk-text-muted)]">Loading track&hellip;</p>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="wk-mobile-v5 px-5 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <i className="ri-file-music-line text-[var(--wk-text-faint)] text-[24px]" />
        </div>
        <p className="text-[var(--wk-text-muted)] mb-3">{error || 'Track not found.'}</p>
        <Link to="/charts" className="mt-4 inline-block text-[14px] font-bold text-[var(--wk-brand)]">Back to charts</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="wk-mobile-v5 min-h-screen">
        <div className="px-5 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <WkIcon name="Check" size={30} className="text-emerald-500" />
          </div>
          <h1 className="mb-2 text-[22px] font-black text-[var(--wk-text)]">Lyrics submitted!</h1>
          <p className="mb-6 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
            Timed lyrics for <strong className="text-[var(--wk-text)]">{track.title}</strong> are now pending community review.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link to={`/tracks/${artistSlug}/${trackSlug}`} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-2.5 text-[13px] font-bold text-[var(--wk-text)]">Back to track</Link>
            <button onClick={() => setSubmitted(false)} className="rounded-xl bg-[var(--wk-brand)] px-6 py-2.5 text-[13px] font-bold text-white">Submit another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wk-mobile-v5 min-h-screen bg-[var(--wk-bg)]">
      {/* Compact header */}
      <div className="sticky top-0 z-10 border-b border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to={`/tracks/${artistSlug}/${trackSlug}`} className="text-[var(--wk-text-muted)]">
            <WkIcon name="ArrowLeft" size={18} />
          </Link>
          {track.artworkUrl && <img src={track.artworkUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold text-[var(--wk-text)]">{track.title}</div>
            <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{track.artist}</div>
          </div>
          <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand)]">{formatTime(currentTime)}</span>
          <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand)] text-white">
            <WkIcon name={isThisTrackPlaying ? 'Pause' : 'Play'} size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-6">
        <h1 className="mb-1 text-[20px] font-black text-[var(--wk-text)]">Add timed lyrics</h1>
        <p className="mb-6 text-[12px] text-[var(--wk-text-muted)]">Play the track and tap <strong>Set</strong> as each line plays</p>

        <div className="space-y-2.5">
          {lines.map((line, idx) => (
            <div key={line.id} className="flex items-center gap-2">
              <button
                onClick={() => stampTimestamp(line.id)}
                className={`flex h-10 w-[60px] flex-shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold whitespace-nowrap ${
                  line.timestampSeconds !== null
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                    : 'border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)]'
                }`}
              >
                {line.timestampSeconds !== null ? formatTime(line.timestampSeconds) : 'Set'}
              </button>
              <input
                type="text"
                value={line.text}
                onChange={(e) => updateLineText(line.id, e.target.value)}
                placeholder={idx === 0 ? '♪ intro ♪' : 'Line text...'}
                className="min-w-0 flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder-[var(--wk-text-faint)] outline-none"
              />
              {lines.length > 2 && (
                <button onClick={() => removeLine(line.id)} className="flex-shrink-0 p-1 text-[var(--wk-text-faint)]">
                  <WkIcon name="Close" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addLine} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--wk-border)] py-2.5 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          <WkIcon name="Add" size={14} /> Add line
        </button>

        <div className="mt-4">
          <label className="mb-1.5 block text-[11px] font-bold text-[var(--wk-text-muted)]">Source (optional)</label>
          <input
            type="text"
            value={sourceDescription}
            onChange={(e) => setSourceDescription(e.target.value)}
            placeholder="e.g. Official lyric video"
            className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder-[var(--wk-text-faint)] outline-none"
          />
        </div>

        {submitError && <div className="mt-3 rounded-lg border border-red-200 bg-red-500/5 px-3 py-2 text-[12px] text-red-600">{submitError}</div>}

        <button onClick={handleSubmit} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--wk-brand)] py-3 text-[14px] font-bold text-white">
          <WkIcon name="Check" size={16} /> Submit for review
        </button>

        <div className="mt-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Guidelines</h3>
          <ul className="space-y-1.5 text-[11px] text-[var(--wk-text-soft)]">
            <li>• Play the track and tap <strong>Set</strong> at the exact moment each line begins</li>
            <li>• Include section markers like <strong>, Chorus ,</strong></li>
            <li>• Mark instrumental sections with <strong>♪ ♪</strong></li>
            <li>• Add a source description for verifiability</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
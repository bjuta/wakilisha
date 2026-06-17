import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePlayer } from '@/context/PlayerContext';
import { WkIcon } from '@/components/design-system/Icon';

const TRACK_DETAILS: any[] = [];
function getTrackBySlug(_slug: string): any { return undefined; }

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

export default function LyricContribution() {
  const { artistSlug, trackSlug } = useParams<{ artistSlug: string; trackSlug: string }>();
  const slug = trackSlug || '';
  const { playTrack, currentTrack, isPlaying, togglePlay, currentTime, seek, pause } = usePlayer();
  const track = getTrackBySlug(slug);

  const [lines, setLines] = useState<DraftLine[]>([
    { id: nextLineId(), text: '', timestampSeconds: 0 },
    { id: nextLineId(), text: '', timestampSeconds: null },
    { id: nextLineId(), text: '', timestampSeconds: null },
    { id: nextLineId(), text: '', timestampSeconds: null },
  ]);
  const [sourceDescription, setSourceDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const isThisTrackPlaying = currentTrack?.id === slug && isPlaying;

  // Auto-play the track when entering the page
  useEffect(() => {
    if (track && track.isPlayable && currentTrack?.id !== slug) {
      playTrack(
        { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source, duration: track.duration },
        TRACK_DETAILS.filter((t) => t.isPlayable).map((t) => ({ id: t.slug, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl, isPlayable: t.isPlayable, source: t.source, duration: t.duration }))
      );
    }
  }, [slug, track, playTrack, currentTrack]);

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
      prev.map((l) => (l.id === lineId ? { ...l, timestampSeconds: Math.round(currentTime * 10) / 10 } : l))
    );
  }, [currentTime]);

  const handleSubmit = useCallback(() => {
    // Validate
    const filledLines = lines.filter((l) => l.text.trim() && l.timestampSeconds !== null);
    if (filledLines.length < 2) {
      setError('Add at least 2 timed lines before submitting.');
      return;
    }
    // Sort by timestamp
    const sorted = [...filledLines].sort((a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0));

    // In a real app, this would save to Supabase
    // For now, show success
    setError('');
    setSubmitted(true);
  }, [lines]);

  if (!track) {
    return (
      <main className="min-h-screen px-6 py-20 text-center">
        <p className="text-[var(--wk-text-muted)]">Track not found.</p>
        <Link to="/charts" className="mt-4 inline-block text-[14px] font-bold text-[var(--wk-brand)]">Back to charts</Link>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-[640px] px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <WkIcon name="Check" size={36} className="text-emerald-500" />
          </div>
          <h1 className="mb-3 text-[28px] font-black text-[var(--wk-text)]">Lyrics submitted!</h1>
          <p className="mb-8 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
            Your timed lyrics for <strong className="text-[var(--wk-text)]">{track.title}</strong> are now pending community review.
            Once more contributors upvote than downvote, they&apos;ll go live.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to={`/tracks/${artistSlug}/${trackSlug}`} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-3 text-[14px] font-bold text-[var(--wk-text)]">Back to track</Link>
            <button onClick={() => setSubmitted(false)} className="rounded-xl bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)]">Submit another</button>
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
          <Link to={`/tracks/${artistSlug}/${trackSlug}`} className="flex items-center gap-2 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]">
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
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">
            {error}
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
              <span className="mt-0.5 text-[var(--wk-brand)]">•</span>
              Play the track and click <strong>Set</strong> at the exact moment each line begins
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">•</span>
              Include section markers like <strong>— Chorus —</strong> and <strong>— Verse 2 —</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">•</span>
              Mark instrumental sections with <strong>♪ instrumental ♪</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">•</span>
              Add a source description so other reviewers can verify accuracy
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--wk-brand)]">•</span>
              Your submission goes through community voting. If upvotes exceed downvotes, it goes live.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
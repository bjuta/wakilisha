import { useEffect, useRef } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import type { TimedLyricLine } from '@/mocks/timedLyrics';

interface SyncedLyricsDisplayProps {
  lines: TimedLyricLine[];
  isPlaying: boolean;
}

function findActiveLineIndex(lines: TimedLyricLine[], currentSeconds: number): number {
  if (!lines || lines.length === 0) return -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentSeconds >= lines[i].timestampSeconds) {
      return i;
    }
  }
  return -1;
}

export function SyncedLyricsDisplay({ lines, isPlaying }: SyncedLyricsDisplayProps) {
  const { currentTime } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  const activeIndex = findActiveLineIndex(lines, currentTime);

  useEffect(() => {
    if (!isPlaying) return;
    if (activeIndex === -1) return;

    const el = activeLineRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const containerHeight = container.clientHeight;
    const elTop = el.offsetTop;
    const elHeight = el.clientHeight;
    const scrollTarget = elTop - containerHeight / 2 + elHeight / 2;

    container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  }, [activeIndex, isPlaying]);

  if (!lines || lines.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative h-[420px] overflow-y-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-16"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="flex flex-col items-center gap-3">
        {lines.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;
          const isSection = line.text.startsWith('—') || line.text.startsWith('♪');
          const isUpcoming = idx > activeIndex;

          return (
            <p
              key={idx}
              ref={isActive ? activeLineRef : undefined}
              className={[
                'text-center transition-all duration-500 ease-out',
                isSection ? 'text-[11px] font-bold uppercase tracking-[0.2em]' : 'text-[18px] lg:text-[22px]',
                isActive && !isSection
                  ? 'scale-110 font-extrabold text-[var(--wk-brand)] opacity-100'
                  : isActive && isSection
                    ? 'font-bold text-[var(--wk-brand)]/70 opacity-80'
                    : isPast
                      ? 'text-[var(--wk-text-muted)]/30 opacity-30'
                      : isUpcoming && !isSection
                        ? 'text-[var(--wk-text-muted)]/50 opacity-50'
                        : 'text-[var(--wk-text-faint)]/30 opacity-25',
              ].join(' ')}
            >
              {line.text}
            </p>
          );
        })}
      </div>

      {activeIndex === -1 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[14px] text-[var(--wk-text-faint)]">
            {isPlaying ? '♪' : 'Press play to start'}
          </p>
        </div>
      )}

      {/* Top and bottom fade gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[var(--wk-surface)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--wk-surface)] to-transparent" />
    </div>
  );
}
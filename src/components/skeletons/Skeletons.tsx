export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="h-40 rounded-lg bg-[var(--wk-surface-raised)]" />
      <div className="mt-3 h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
      <div className="mt-2 h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
    </div>
  );
}

export function SkeletonSquare() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="aspect-square rounded-lg bg-[var(--wk-surface-raised)]" />
      <div className="mt-3 h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
      <div className="mt-2 h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
    </div>
  );
}

export function SkeletonChartRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 px-4 py-4">
      <div className="h-6 w-8 rounded bg-[var(--wk-surface-raised)]" />
      <div className="h-10 w-10 rounded-lg bg-[var(--wk-surface-raised)]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
      </div>
    </div>
  );
}

export function SkeletonStoryCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      <div className="aspect-video bg-[var(--wk-surface-raised)]" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
      </div>
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-32 rounded bg-[var(--wk-surface-raised)] mb-3" />
      <div className="h-10 w-2/3 rounded bg-[var(--wk-surface-raised)] mb-4" />
      <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] mb-8" />
      <div className="flex gap-3">
        <div className="h-10 w-32 rounded-full bg-[var(--wk-surface-raised)]" />
        <div className="h-10 w-32 rounded-full bg-[var(--wk-surface-raised)]" />
      </div>
    </div>
  );
}
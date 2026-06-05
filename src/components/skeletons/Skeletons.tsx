/* ── Design-system skeleton token ──
   Every skeleton uses `--wk-*` CSS variables exclusively.
   No hard-coded colors. No exceptions.
   Pulse animation + surface/border tokens = one consistent loading language. */

/* ─────────────────────────── Primitives ─────────────────────────── */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--wk-surface-raised)] ${className}`} />;
}

export function SkeletonText({ lines = 1, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded h-3.5 bg-[var(--wk-surface-raised)]"
          style={{ width: i === lines - 1 && lines > 1 ? "62%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return (
    <div
      className="animate-pulse rounded-full bg-[var(--wk-surface-raised)] shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

/* ─────────────────────────── Cards ─────────────────────────── */

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

/* ─────────────────────────── Rows ─────────────────────────── */

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

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="animate-pulse flex items-center gap-4 px-4 py-3.5 border-b border-[var(--wk-border)]">
      <SkeletonCircle size={32} />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <div key={i} className="flex-1 h-3.5 rounded bg-[var(--wk-surface-raised)]" />
      ))}
    </div>
  );
}

export function SkeletonKpiCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--wk-surface-raised)]" />
      </div>
      <div className="h-6 w-16 rounded bg-[var(--wk-surface-raised)] mb-1" />
      <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
    </div>
  );
}

/* ─────────────────────────── Page-level skeletons ─────────────────────────── */

export function SkeletonPage({ blocks = 4 }: { blocks?: number }) {
  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      <div className="max-w-[1180px] mx-auto px-6 py-14 space-y-8">
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
            <div className="h-4 w-24 rounded bg-[var(--wk-surface-raised)] mb-4" />
            <div className="h-8 w-1/2 rounded bg-[var(--wk-surface-raised)] mb-3" />
            <div className="h-3 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Chart edition loader: matches the hero + content layout ── */
export function SkeletonChartEdition() {
  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero area */}
      <div className="relative h-[420px] md:h-[520px] animate-pulse bg-[var(--wk-surface)]">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 max-w-[1280px] mx-auto space-y-4">
          <div className="h-4 w-48 rounded-full bg-white/10" />
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="h-12 w-2/3 rounded bg-white/12" />
          <div className="h-4 w-1/2 rounded bg-white/8" />
          <div className="flex gap-3 mt-4">
            <div className="h-10 w-28 rounded-full bg-white/10" />
            <div className="h-10 w-28 rounded-full bg-white/8" />
          </div>
        </div>
      </div>
      {/* Rows */}
      <div className="max-w-[1280px] mx-auto px-6 py-10 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonChartRow key={i} />
        ))}
      </div>
    </main>
  );
}

/* ── Magazine page loader ── */
export function SkeletonMagazinePage() {
  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero area */}
      <div className="relative h-[70vh] min-h-[480px] animate-pulse bg-[var(--wk-surface)]">
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/70" />
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-20 max-w-[1280px] mx-auto space-y-4">
          <div className="h-8 w-40 rounded-full bg-white/10" />
          <div className="h-5 w-32 rounded bg-white/8" />
          <div className="h-16 w-2/3 rounded bg-white/10" />
          <div className="h-5 w-1/2 rounded bg-white/6" />
        </div>
      </div>
      {/* Grid */}
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:items-stretch mb-16">
          <div className="lg:col-span-3 animate-pulse rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] min-h-[340px]" />
          <div className="lg:col-span-2 grid grid-cols-1 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] h-[100px]" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonStoryCard key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}

/* ── Article page loader ── */
export function SkeletonArticlePage() {
  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero image */}
      <div className="relative h-[60vh] min-h-[400px] animate-pulse bg-[var(--wk-surface)]">
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-[var(--wk-bg)]" />
      </div>
      {/* Floating card */}
      <div className="relative z-10 rounded-t-[28px] bg-[var(--wk-bg)] -mt-[72px] px-6 max-w-[740px] mx-auto">
        <div className="animate-pulse space-y-4 pt-10 pb-8">
          <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)]" />
          <div className="h-10 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
          <div className="h-5 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
          <div className="flex items-center gap-3 pt-2">
            <div className="h-10 w-10 rounded-full bg-[var(--wk-surface-raised)]" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
            </div>
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="max-w-[740px] mx-auto px-6 pb-16 space-y-3">
        <div className="h-px bg-[var(--wk-border)] mb-8" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse h-4 rounded bg-[var(--wk-surface-raised)]"
            style={{ width: i % 5 === 0 ? "92%" : i % 7 === 0 ? "78%" : "100%" }}
          />
        ))}
      </div>
    </main>
  );
}

/* ── Admin guard loader: full-screen minimal ── */
export function SkeletonAdminGuard() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--wk-bg)]">
      <div className="animate-pulse space-y-5 w-full max-w-[400px] px-6">
        <div className="h-10 w-48 rounded bg-[var(--wk-surface-raised)] mx-auto" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-[var(--wk-surface-raised)]" />
          <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
        </div>
        <div className="h-10 w-32 rounded-full bg-[var(--wk-surface-raised)] mx-auto" />
      </div>
    </div>
  );
}

/* ── Table page loader (admin lists: users, articles, etc.) ── */
export function SkeletonAdminTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-28 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-6 w-48 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-3 w-64 rounded bg-[var(--wk-surface-raised)]" />
      </div>
      {/* Table */}
      <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
        {/* Header row */}
        <div className="animate-pulse flex items-center gap-4 px-4 py-3 border-b border-[var(--wk-border)] bg-[var(--wk-bg-subtle)]">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </div>
    </div>
  );
}

/* ── Admin dashboard loader ── */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-32 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-6 w-48 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-3 w-72 rounded bg-[var(--wk-surface-raised)]" />
      </div>
      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>
      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SkeletonBlock className="h-[200px] rounded-xl border border-[var(--wk-border)]" />
          <SkeletonBlock className="h-[240px] rounded-xl border border-[var(--wk-border)]" />
        </div>
        <div className="space-y-4">
          <SkeletonBlock className="h-[180px] rounded-xl border border-[var(--wk-border)]" />
          <SkeletonBlock className="h-[220px] rounded-xl border border-[var(--wk-border)]" />
        </div>
      </div>
    </div>
  );
}

/* ── Ingest studio loader ── */
export function SkeletonIngestStudio() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-28 rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-6 w-56 rounded bg-[var(--wk-surface-raised)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>
      <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 animate-pulse">
        <div className="h-4 w-40 rounded bg-[var(--wk-surface-raised)] mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-lg bg-[var(--wk-surface-raised)]" />
              <div className="flex-1 h-3.5 rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Search page loader ── */
export function SkeletonSearch() {
  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      <div className="max-w-[1180px] mx-auto px-6 py-14">
        <div className="animate-pulse space-y-4 mb-8">
          <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
          <div className="h-10 w-40 rounded bg-[var(--wk-surface-raised)]" />
          <div className="h-12 w-full max-w-2xl rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border)]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
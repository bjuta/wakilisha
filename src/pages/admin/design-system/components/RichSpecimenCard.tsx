import type { WkRichMediaSpecimen } from '../../../../design-system/designSystemSpec';
import { WkTag } from '../../../../components/design-system/primitives/Tag';

export function RichSpecimenCard({ item }: { item: WkRichMediaSpecimen }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)]">
      <SpecimenCanvas item={item} />
      <div className="border-t border-[var(--wk-border)] p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <WkTag variant="brand">{item.kind}</WkTag>
          {item.count > 1 && <WkTag>{item.count} pieces</WkTag>}
          {item.canonicalClass && <WkTag>{item.canonicalClass}</WkTag>}
        </div>
        <h4 className="text-[15px] font-black tracking-tight text-[var(--wk-text)]">{item.label}</h4>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">{item.implementation}</p>
      </div>
    </div>
  );
}

function SpecimenCanvas({ item }: { item: WkRichMediaSpecimen }) {
  const id = item.id.toLowerCase();
  if (id.includes('swatch') || id.includes('token') || id.includes('color') || id.includes('theme')) return <TokenBoard />;
  if (id.includes('player') || id.includes('dock') || id.includes('sheet') || id.includes('theater')) return <PlayerBoard />;
  if (id.includes('chart') || id.includes('track') || id.includes('row')) return <RowBoard />;
  if (id.includes('mobile') || id.includes('phone')) return <MobileBoard />;
  if (id.includes('logo') || id.includes('safe-zone')) return <LogoBoard />;
  if (id.includes('motion') || id.includes('animation') || id.includes('morph') || id.includes('pulse') || id.includes('shimmer') || id.includes('equalizer') || id.includes('slide')) return <MotionBoard />;
  if (id.includes('modal') || id.includes('overlay') || id.includes('share')) return <OverlayBoard />;
  if (id.includes('article') || id.includes('magazine') || id.includes('story')) return <EditorialBoard />;
  return <CardBoard />;
}

function TokenBoard() {
  const tokens = ['--wk-bg', '--wk-surface', '--wk-surface-raised', '--wk-brand', '--wk-success', '--wk-warning', '--wk-danger', '--wk-info'];
  return (
    <div className="grid grid-cols-4 gap-2 p-4">
      {tokens.map((token) => (
        <div key={token} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2">
          <div className="h-12 rounded-lg border border-[var(--wk-border-2)]" style={{ background: `var(${token})` }} />
          <div className="mt-2 truncate font-mono text-[9px] text-[var(--wk-text-faint)]">{token}</div>
        </div>
      ))}
    </div>
  );
}

function PlayerBoard() {
  return (
    <div className="p-4">
      <div className="mb-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
        <div className="mb-3 h-20 rounded-xl bg-[linear-gradient(135deg,var(--wk-brand-soft),var(--wk-surface-raised))]" />
        <div className="mb-2 h-3 w-2/3 rounded-full bg-[var(--wk-text)]" />
        <div className="h-2 w-1/3 rounded-full bg-[var(--wk-text-faint)]" />
      </div>
      <div className="flex h-14 items-center gap-3 rounded-xl border border-[var(--wk-border-2)] bg-[var(--wk-surface)] p-2 shadow-[var(--wk-shadow)]">
        <div className="h-10 w-10 rounded-lg bg-[var(--wk-brand)]" />
        <div className="min-w-0 flex-1"><div className="h-2.5 w-2/3 rounded-full bg-[var(--wk-text)]" /><div className="mt-2 h-2 w-1/3 rounded-full bg-[var(--wk-text-faint)]" /></div>
        <div className="h-8 w-8 rounded-full bg-[var(--wk-text)]" />
      </div>
    </div>
  );
}

function RowBoard() {
  return (
    <div className="p-4">
      {[1, 2, 3].map((rank) => (
        <div key={rank} className="grid grid-cols-[32px_44px_1fr_42px] items-center gap-3 border-b border-[var(--wk-border)] py-2 last:border-0">
          <div className="text-right text-xl font-black text-[var(--wk-brand)]">{rank}</div>
          <div className="h-11 w-11 rounded-lg bg-[linear-gradient(135deg,var(--wk-brand),var(--wk-surface-raised))]" />
          <div><div className="h-2.5 w-3/4 rounded-full bg-[var(--wk-text)]" /><div className="mt-2 h-2 w-1/2 rounded-full bg-[var(--wk-text-muted)]" /></div>
          <div className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-1 text-center text-[10px] font-bold text-[var(--wk-brand)]">+{rank}</div>
        </div>
      ))}
    </div>
  );
}

function MobileBoard() {
  return (
    <div className="flex justify-center p-4">
      <div className="relative h-48 w-28 overflow-hidden rounded-[28px] border border-[var(--wk-border-2)] bg-[var(--wk-bg)] p-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--wk-border-strong)]" />
        <div className="mb-3 h-16 rounded-xl bg-[var(--wk-surface)]" />
        <div className="flex gap-2"><div className="h-14 flex-1 rounded-xl bg-[var(--wk-surface-raised)]" /><div className="h-14 flex-1 rounded-xl bg-[var(--wk-brand-soft)]" /></div>
        <div className="absolute bottom-0 left-0 right-0 grid h-10 grid-cols-4 border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">{[1,2,3,4].map((i) => <div key={i} className="m-auto h-2 w-2 rounded-full bg-[var(--wk-text-faint)]" />)}</div>
      </div>
    </div>
  );
}

function LogoBoard() {
  return <div className="p-4"><div className="rounded-2xl border border-dashed border-[var(--wk-brand)] bg-[var(--wk-bg-subtle)] p-8 text-center"><div className="mx-auto h-8 w-44 rounded bg-[var(--wk-text)]" /><div className="mx-auto mt-2 h-8 w-10 skew-x-[-16deg] bg-[var(--wk-brand)]" /><div className="mt-4 font-mono text-[10px] text-[var(--wk-text-muted)]">safe zone = bolt height</div></div></div>;
}

function MotionBoard() {
  return <div className="relative h-40 overflow-hidden p-4"><div className="absolute left-5 top-5 h-24 w-16 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]" /><div className="absolute bottom-5 left-1/2 h-16 w-32 -translate-x-1/2 rounded-t-3xl border border-[var(--wk-border-2)] bg-[var(--wk-surface-raised)] shadow-[var(--wk-shadow)]" /><div className="absolute right-6 top-7 flex h-12 items-end gap-1">{[30,65,45,85,55].map((h,i) => <span key={i} className="w-1.5 animate-pulse rounded-full bg-[var(--wk-brand)]" style={{height:`${h}%`}} />)}</div></div>;
}

function OverlayBoard() {
  return <div className="p-4"><div className="mx-auto max-w-xs rounded-t-3xl border border-[var(--wk-border-2)] bg-[var(--wk-surface)] p-4 shadow-[var(--wk-shadow-lg)]"><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--wk-border-strong)]" /><div className="mb-3 grid grid-cols-[48px_1fr] gap-3 rounded-xl bg-[var(--wk-bg-subtle)] p-3"><div className="h-12 rounded-lg bg-[var(--wk-brand)]" /><div className="space-y-2"><div className="h-2.5 w-full rounded-full bg-[var(--wk-text)]" /><div className="h-2 w-2/3 rounded-full bg-[var(--wk-text-muted)]" /></div></div><div className="grid grid-cols-4 gap-2">{[1,2,3,4].map((i) => <div key={i} className="h-9 rounded-lg bg-[var(--wk-surface-raised)]" />)}</div></div></div>;
}

function EditorialBoard() {
  return <div className="p-4"><div className="mb-3 h-24 rounded-2xl bg-[linear-gradient(135deg,var(--wk-brand-soft),var(--wk-surface-raised))]" /><div className="mb-2 h-4 w-5/6 rounded-full bg-[var(--wk-text)]" /><div className="mb-3 h-2.5 w-2/3 rounded-full bg-[var(--wk-text-muted)]" /><div className="grid grid-cols-3 gap-2">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-[var(--wk-surface)]" />)}</div></div>;
}

function CardBoard() {
  return <div className="grid grid-cols-2 gap-3 p-4">{[1,2].map((i) => <div key={i} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 transition-transform hover:-translate-y-1 hover:shadow-[var(--wk-shadow)]"><div className="mb-3 aspect-square rounded-xl bg-[linear-gradient(135deg,var(--wk-brand-soft),var(--wk-surface-raised))]" /><div className="mb-2 h-2.5 rounded-full bg-[var(--wk-text)]" /><div className="h-2 w-2/3 rounded-full bg-[var(--wk-text-muted)]" /></div>)}</div>;
}

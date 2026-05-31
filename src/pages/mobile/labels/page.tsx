import { useState } from "react";
import { Link } from "react-router-dom";
import { LABELS, FEATURED_LABELS } from "@/mocks/labels";
import { WkIcon } from "@/components/design-system/Icon";

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export default function MobileLabels() {
  const [query, setQuery] = useState("");
  const filtered = LABELS.filter((label) => !query.trim() || label.name.toLowerCase().includes(query.toLowerCase()) || (label.country || "").toLowerCase().includes(query.toLowerCase()));
  const spotlight = FEATURED_LABELS[0] ?? LABELS[0];
  const totalReleases = LABELS.reduce((s, l) => s + l.releaseCount, 0).toLocaleString();

  return (
    <div className="wk-mobile-v5">
      <section className="charts-hdr">
        <div className="charts-ed-badge"><WkIcon name="Building2" size={14} /> Registry</div>
        <h1 className="charts-title">Labels</h1>
        <p className="charts-meta">{LABELS.length} institutions · {totalReleases} releases connected</p>
      </section>

      <div className="search-bar-zone">
        <label className="search-input">
          <WkIcon name="Search" size={17} className="search-input-icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search labels" />
          {query && <button onClick={() => setQuery("")} className="search-input-icon" aria-label="Clear label search"><WkIcon name="X" size={17} /></button>}
        </label>
      </div>

      {spotlight && (
        <div className="px-5 pb-4">
          <Link to={`/labels/${spotlight.slug}`} className="mobile-pressable block rounded-[16px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="lbl-avatar">{spotlight.logoUrl ? <img src={spotlight.logoUrl} alt="" /> : initials(spotlight.name)}</div>
              <div className="min-w-0">
                <div className="mag-card-tag">Spotlight</div>
                <div className="lbl-name">{spotlight.name}</div>
                <div className="lbl-meta">{spotlight.country || "Global"}</div>
              </div>
              <WkIcon name="BadgeCheck" size={17} className="ml-auto text-[var(--wk-brand)]" />
            </div>
            <div className="flex gap-4 text-[11px] text-[var(--wk-text-muted)]">
              <span className="inline-flex items-center gap-1"><WkIcon name="Users" size={12} /> {spotlight.artistCount} artists</span>
              <span className="inline-flex items-center gap-1"><WkIcon name="Album" size={12} /> {spotlight.releaseCount} releases</span>
            </div>
          </Link>
        </div>
      )}

      <div className="spec-section-hd">Featured labels</div>
      <div className="phn-scroll-row">
        {FEATURED_LABELS.map((label) => (
          <Link key={label.slug} to={`/labels/${label.slug}`} className="mobile-pressable block w-[190px] shrink-0 rounded-[16px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
            <div className="lbl-avatar mb-3">{label.logoUrl ? <img src={label.logoUrl} alt="" /> : initials(label.name)}</div>
            <div className="lbl-name">{label.name}</div>
            <div className="lbl-meta">{label.artistCount} artists · {label.releaseCount} releases</div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">All labels</div>
      <div className="labels-list">
        {filtered.map((label) => (
          <Link key={label.slug} to={`/labels/${label.slug}`} className="lbl-row mobile-pressable">
            <div className="lbl-avatar">{label.logoUrl ? <img src={label.logoUrl} alt="" /> : initials(label.name)}</div>
            <div>
              <div className="lbl-name">{label.name}</div>
              <div className="lbl-meta">{label.country || "Unknown"} · {label.artistCount} artists · {label.releaseCount} releases</div>
            </div>
            <WkIcon name="ChevronRight" size={16} className="lbl-chevron" />
          </Link>
        ))}
        {filtered.length === 0 && <div className="px-5 py-12 text-center text-[var(--wk-text-muted)]"><WkIcon name="Building2" size={32} className="mx-auto mb-3" />No labels match this search.</div>}
      </div>
    </div>
  );
}

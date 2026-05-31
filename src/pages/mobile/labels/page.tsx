import { useState } from "react";
import { Link } from "react-router-dom";
import { LABELS, FEATURED_LABELS } from "@/mocks/labels";

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export default function MobileLabels() {
  const [query, setQuery] = useState("");
  const filtered = LABELS.filter((label) => !query.trim() || label.name.toLowerCase().includes(query.toLowerCase()) || (label.country || "").toLowerCase().includes(query.toLowerCase()));
  const spotlight = FEATURED_LABELS[0] ?? LABELS[0];

  return (
    <div className="wk-mobile-v5">
      <section className="charts-hdr">
        <div className="charts-ed-badge"><i className="ri-building-2-line" /> Registry</div>
        <h1 className="charts-title">Labels</h1>
        <p className="charts-meta">{LABELS.length} institutions · {LABELS.reduce((s, l) => s + l.releaseCount, 0).toLocaleString()} releases connected</p>
      </section>

      <div className="search-bar-zone">
        <label className="search-input">
          <i className="ri-search-line search-input-icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search labels" />
        </label>
      </div>

      {spotlight && (
        <div className="px-5 pb-4">
          <Link to={`/labels/${spotlight.slug}`} className="block rounded-[16px] border border-white/10 bg-[#141712] p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="lbl-avatar">{spotlight.logoUrl ? <img src={spotlight.logoUrl} alt="" /> : initials(spotlight.name)}</div>
              <div>
                <div className="mag-card-tag">Spotlight</div>
                <div className="lbl-name">{spotlight.name}</div>
                <div className="lbl-meta">{spotlight.country || "Global"}</div>
              </div>
            </div>
            <div className="flex gap-4 text-[11px] text-white/45">
              <span>{spotlight.artistCount} artists</span><span>{spotlight.releaseCount} releases</span>
            </div>
          </Link>
        </div>
      )}

      <div className="spec-section-hd">Featured labels</div>
      <div className="phn-scroll-row">
        {FEATURED_LABELS.map((label) => (
          <Link key={label.slug} to={`/labels/${label.slug}`} className="block w-[190px] shrink-0 rounded-[16px] border border-white/10 bg-[#141712] p-4">
            <div className="lbl-avatar mb-3">{label.logoUrl ? <img src={label.logoUrl} alt="" /> : initials(label.name)}</div>
            <div className="lbl-name">{label.name}</div>
            <div className="lbl-meta">{label.artistCount} artists · {label.releaseCount} releases</div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">All labels</div>
      <div className="labels-list">
        {filtered.map((label) => (
          <Link key={label.slug} to={`/labels/${label.slug}`} className="lbl-row">
            <div className="lbl-avatar">{label.logoUrl ? <img src={label.logoUrl} alt="" /> : initials(label.name)}</div>
            <div>
              <div className="lbl-name">{label.name}</div>
              <div className="lbl-meta">{label.country || "Unknown"} · {label.artistCount} artists · {label.releaseCount} releases</div>
            </div>
            <i className="ri-arrow-right-s-line lbl-chevron" />
          </Link>
        ))}
      </div>
    </div>
  );
}

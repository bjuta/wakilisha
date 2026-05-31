import { useState } from "react";
import { Link } from "react-router-dom";
import { RELEASES, RELEASE_FILTERS, FEATURED_RELEASE, NEW_THIS_WEEK, EDITORIAL_PICKS, CHART_CONNECTED_RELEASES, CATALOG_STATS } from "@/mocks/releases";
import { AlbumModal } from "@/components/design-system/releases/AlbumModal";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";

type Release = typeof RELEASES[number];

export default function Releases() {
  const [filter, setFilter] = useState("All");
  const [modalRelease, setModalRelease] = useState<Release | null>(null);
  const filtered = filter === "All" ? RELEASES : RELEASES.filter((release) => release.releaseType === filter);
  const featured = FEATURED_RELEASE.release;

  return (
    <main className="min-h-screen">
      <section className="album41-hero">
        <div className="album41-ambient" style={{ backgroundImage: `url(${featured.artworkUrl})` }} />
        <div className="album41-shade" />
        <div className="album41-inner wk-container-wide">
          <div className="album41-cover"><img src={featured.artworkUrl} alt={featured.title} /></div>
          <div>
            <div className="album41-kicker"><WkIcon name="Album" size={14} /> Releases catalog</div>
            <h1 className="album41-title">Albums & releases</h1>
            <div className="album41-artist"><span>{FEATURED_RELEASE.headline}</span></div>
            <p className="album41-desc mt-4 max-w-2xl">{FEATURED_RELEASE.blurb}</p>
            <div className="album41-meta">
              <span><WkIcon name="Disc3" size={14} /> {CATALOG_STATS.total} releases</span>
              <span><WkIcon name="BarChart3" size={14} /> {CATALOG_STATS.chartConnected} chart-connected</span>
              <span><WkIcon name="Building2" size={14} /> {CATALOG_STATS.labelsRepresented} labels</span>
            </div>
            <div className="album41-actions">
              <button onClick={() => setModalRelease(featured)} className="wk-button wk-button-lg wk-button-primary"><WkIcon name="Play" size={18} /> Preview featured</button>
              <Link to={`/releases/${featured.slug}`} className="wk-button wk-button-lg wk-button-ghost"><WkIcon name="ArrowUpRight" size={18} /> Full page</Link>
              <ShareButton item={{ title: "WAKILISHA Releases", subtitle: `${CATALOG_STATS.total} releases`, description: "Browse albums, EPs, singles and compilations in the WAKILISHA catalog.", imageUrl: featured.artworkUrl, type: "album" }} />
            </div>
          </div>
        </div>
      </section>

      <div className="wk-container-wide px-4 py-10 md:px-6">
        <div className="chart-stats-strip mb-10">
          <Stat value={CATALOG_STATS.thisWeek} label="This week" />
          <Stat value={CATALOG_STATS.thisMonth} label="This month" />
          <Stat value={CATALOG_STATS.chartConnected} label="On charts" />
          <Stat value={CATALOG_STATS.total} label="Catalog" />
        </div>

        <section>
          <div className="section-head">
            <div><div className="section-kicker">New this week</div><h2 className="section-title">Fresh release shelf</h2></div>
            <p className="section-copy">Album cards open a rich modal first, then allow full navigation.</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {NEW_THIS_WEEK.map((item) => <ReleaseTile key={item.release.slug} release={item.release} onPreview={setModalRelease} wide />)}
          </div>
        </section>

        <section>
          <div className="section-head">
            <div><div className="section-kicker">Filters</div><h2 className="section-title">Catalog directory</h2></div>
            <div className="directory-filters">{RELEASE_FILTERS.map((item) => <button key={item} onClick={() => setFilter(item)} className={`directory-filter ${filter === item ? "on" : ""}`}>{item}</button>)}</div>
          </div>
          <div className="artist-directory-grid">
            {filtered.map((release) => <ReleaseTile key={release.slug} release={release} onPreview={setModalRelease} />)}
          </div>
        </section>

        <section className="pg-layout cols-2 pb-10">
          <div className="pg-block">
            <div className="pg-block-label">Editor picks</div>
            <div className="space-y-3">
              {EDITORIAL_PICKS.map((item) => (
                <button key={item.release.slug} onClick={() => setModalRelease(item.release)} className="artist-list-item w-full px-0 text-left">
                  <div className="artist-list-ava artist-list-avatar"><img src={item.release.artworkUrl} alt="" /></div>
                  <div><div className="artist-list-name">{item.release.title}</div><div className="artist-list-sub">{item.pickType} · {item.release.artist}</div></div>
                  <WkIcon name="ArrowRight" size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="pg-block">
            <div className="pg-block-label">Chart-connected releases</div>
            <div className="space-y-3">
              {CHART_CONNECTED_RELEASES.map((item) => (
                <Link key={item.release.slug} to={`/releases/${item.release.slug}`} className="artist-list-item px-0">
                  <div className="artist-list-ava artist-list-avatar"><img src={item.release.artworkUrl} alt="" /></div>
                  <div><div className="artist-list-name">{item.release.title}</div><div className="artist-list-sub">Positions {item.positions.join(", ")} · {item.chartTracks.join(", ")}</div></div>
                  <WkIcon name="BarChart3" size={16} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      <AlbumModal open={Boolean(modalRelease)} release={modalRelease} onClose={() => setModalRelease(null)} />
    </main>
  );
}

function ReleaseTile({ release, onPreview, wide = false }: { release: Release; onPreview: (release: Release) => void; wide?: boolean }) {
  return (
    <div className={`artist-card ${wide ? "w-[240px] shrink-0" : ""}`}>
      <button onClick={() => onPreview(release)} className="artist-card-img block w-full text-left"><img src={release.artworkUrl} alt={release.title} /></button>
      <div className="artist-card-body">
        <div className="artist-card-name">{release.title}</div>
        <div className="artist-card-meta">{release.artist} · {release.year} · {release.trackCount} tracks</div>
        <div className="artist-card-tags"><span className="tag tag-sm">{release.releaseType}</span><span className="tag tag-sm">{release.labelName}</span></div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => onPreview(release)} className="wk-button wk-button-sm wk-button-primary"><WkIcon name="Eye" size={13} /> Preview</button>
          <Link to={`/releases/${release.slug}`} className="wk-button wk-button-sm wk-button-ghost"><WkIcon name="ArrowUpRight" size={13} /> Open</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="chart-stat-card"><div className="chart-stat-value">{value}</div><div className="chart-stat-label">{label}</div></div>;
}

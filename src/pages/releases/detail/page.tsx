import { Link, useParams } from "react-router-dom";
import { RELEASES, CHART_CONNECTED_RELEASES, EDITORIAL_PICKS } from "@/mocks/releases";
import { TRACK_DETAILS } from "@/mocks/trackDetails";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";

const durationFor = (index: number) => `${2 + (index % 3)}:${String(18 + index * 7).padStart(2, "0").slice(0, 2)}`;

function getReleaseTracks(release: typeof RELEASES[number]) {
  const fromAlbum = TRACK_DETAILS.filter((track) => track.albumTitle?.toLowerCase() === release.title.toLowerCase());
  if (fromAlbum.length) return fromAlbum;
  const byArtist = TRACK_DETAILS.filter((track) => track.artist.toLowerCase().includes(release.artist.toLowerCase().split(" ")[0])).slice(0, Math.max(1, Math.min(release.trackCount, 10)));
  if (byArtist.length) return byArtist;
  return Array.from({ length: Math.max(1, Math.min(release.trackCount, 10)) }, (_, index) => ({
    slug: `${release.slug}-track-${index + 1}`,
    title: index === 0 ? release.title : `${release.title} · Track ${index + 1}`,
    artist: release.artist,
    duration: 160 + index * 9,
    source: undefined,
    artworkUrl: release.artworkUrl,
    isPlayable: false,
  }));
}

export default function ReleaseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const release = RELEASES.find((item) => item.slug === slug);

  if (!release) {
    return (
      <main className="wk-container px-6 py-20 text-center">
        <WkIcon name="Album" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Release not found</h1>
        <p className="text-[var(--wk-text-muted)]">This release does not exist in the WAKILISHA catalog.</p>
        <Link to="/releases" className="btn btn-md btn-primary mt-6">Back to releases</Link>
      </main>
    );
  }

  const tracks = getReleaseTracks(release);
  const chartConnection = CHART_CONNECTED_RELEASES.find((item) => item.release.slug === release.slug);
  const editorial = EDITORIAL_PICKS.find((item) => item.release.slug === release.slug);
  const related = RELEASES.filter((item) => item.slug !== release.slug && (item.artist === release.artist || item.labelName === release.labelName || item.releaseType === release.releaseType)).slice(0, 4);
  const totalDuration = tracks.reduce((sum, track: any) => sum + (track.duration || 0), 0);
  const minutes = totalDuration ? Math.round(totalDuration / 60) : release.trackCount * 3;

  return (
    <main className="min-h-screen">
      <section className="album41-hero">
        <div className="album41-ambient" style={{ backgroundImage: `url(${release.artworkUrl})` }} />
        <div className="album41-shade" />
        <div className="album41-inner wk-container-wide">
          <div className="album41-cover"><img src={release.artworkUrl} alt={release.title} /></div>
          <div>
            <div className="album41-kicker"><WkIcon name="Album" size={14} /> {release.releaseType}</div>
            <h1 className="album41-title">{release.title}</h1>
            <div className="album41-artist">
              <span>{release.artist}</span>
              <span>·</span>
              <span>{release.labelName}</span>
            </div>
            <div className="album41-meta">
              <span><WkIcon name="Calendar" size={14} /> {release.year}</span>
              <span><WkIcon name="ListMusic" size={14} /> {release.trackCount} tracks</span>
              <span><WkIcon name="Clock3" size={14} /> {minutes} min</span>
              <span><WkIcon name="Disc3" size={14} /> {release.releaseType}</span>
            </div>
            <div className="album41-actions">
              <button className="btn btn-lg btn-primary"><WkIcon name="Play" size={18} /> Play</button>
              <button className="btn btn-lg btn-ghost"><WkIcon name="Shuffle" size={18} /> Shuffle</button>
              <button className="btn btn-lg btn-ghost"><WkIcon name="Heart" size={18} /> Save</button>
              <ShareButton item={{ title: release.title, subtitle: release.artist, description: `${release.releaseType} by ${release.artist} on WAKILISHA`, imageUrl: release.artworkUrl, type: "album" }} />
            </div>
          </div>
        </div>
      </section>

      <div className="album41-body">
        <div className="grid gap-5">
          <section className="album41-card">
            <div className="album41-card-title"><WkIcon name="FileText" size={15} /> Overview</div>
            <p className="album41-desc">
              {editorial?.blurb ?? `${release.title} is a ${release.releaseType.toLowerCase()} by ${release.artist}, released in ${release.year} through ${release.labelName}. This page gathers its tracklist, label context, chart connections, and catalog metadata.`}
            </p>
            <div className="album41-tags mt-5">
              {[release.releaseType, release.labelName, String(release.year), release.artist].map((tag) => <span key={tag} className="tag tag-sm">{tag}</span>)}
            </div>
          </section>

          <section>
            <div className="section-head">
              <div><div className="section-kicker">Tracklist</div><h2 className="section-title">{release.trackCount} tracks</h2></div>
            </div>
            <div className="album41-tracklist">
              {tracks.map((track: any, index) => (
                <Link key={`${track.slug}-${index}`} to={track.slug?.startsWith(release.slug) ? `/releases/${release.slug}` : `/tracks/${track.slug}`} className="album41-track">
                  <div className="album41-track-num">{index + 1}</div>
                  <div className="min-w-0"><div className="album41-track-title">{track.title}</div><div className="album41-track-sub">{track.artist || release.artist}{track.source ? ` · ${track.source}` : ""}</div></div>
                  <div className="album41-duration">{track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : durationFor(index)}</div>
                  <button className="chart-btn" onClick={(e) => e.preventDefault()}><WkIcon name="Play" size={14} /></button>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="album41-side">
          <section className="album41-card">
            <div className="album41-card-title"><WkIcon name="Activity" size={15} /> Release stats</div>
            <div className="album41-stat-grid">
              <Stat value={release.trackCount} label="Tracks" />
              <Stat value={minutes} label="Minutes" />
              <Stat value={chartConnection ? chartConnection.chartTracks.length : 0} label="Chart tracks" />
              <Stat value={release.year} label="Year" />
            </div>
          </section>

          {chartConnection && (
            <section className="album41-card">
              <div className="album41-card-title"><WkIcon name="BarChart3" size={15} /> Chart performance</div>
              <div className="space-y-3">
                {chartConnection.chartTracks.map((track, index) => (
                  <div key={track} className="artist-list-item px-0">
                    <div className="artist-list-ava flex items-center justify-center">#{chartConnection.positions[index]}</div>
                    <div><div className="artist-list-name">{track}</div><div className="artist-list-sub">Chart-connected track</div></div>
                    <WkIcon name="TrendingUp" size={16} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="album41-card">
            <div className="album41-card-title"><WkIcon name="Building2" size={15} /> Label context</div>
            <div className="artist-list-name">{release.labelName}</div>
            <div className="artist-list-sub">Catalog relationship · {release.releaseType}</div>
            <Link to={`/labels/${release.labelName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`} className="btn btn-sm btn-ghost mt-4">Open label</Link>
          </section>

          {related.length > 0 && (
            <section className="album41-card">
              <div className="album41-card-title"><WkIcon name="Disc3" size={15} /> Related releases</div>
              <div className="space-y-3">
                {related.map((item) => (
                  <Link key={item.slug} to={`/releases/${item.slug}`} className="artist-list-item px-0">
                    <div className="artist-list-ava artist-list-avatar"><img src={item.artworkUrl} alt="" /></div>
                    <div><div className="artist-list-name">{item.title}</div><div className="artist-list-sub">{item.artist} · {item.year}</div></div>
                    <WkIcon name="ArrowRight" size={16} />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="album41-stat"><div className="album41-stat-val">{value}</div><div className="album41-stat-lbl">{label}</div></div>;
}

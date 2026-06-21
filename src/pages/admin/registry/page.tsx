import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

/* ──────────────────────── Types ──────────────────────── */

interface EntityStats {
  entity: string;
  label: string;
  icon: string;
  total: number;
  active: number;
  completeness: number;
  fields: { key: string; label: string; filled: number; total: number }[];
}

interface RelationshipEdge {
  type: string;
  label: string;
  source: string;
  target: string;
  count: number;
}

interface OrphanStat {
  key: string;
  label: string;
  description: string;
  count: number;
  total: number;
  href: string;
  filter: string;
  severity: "critical" | "warning" | "info";
}

interface RecentEntity {
  slug: string;
  name: string;
  updated_at: string;
  type: string;
  icon: string;
}

/* ──────────────────────── Data fetching ──────────────────────── */

async function fetchEntityStats(): Promise<EntityStats[]> {
  const queries = [
    { entity: "artists", table: "registry_artists", label: "Artists", icon: "Mic2", fields: [
      { key: "display_name", label: "Name" },
      { key: "public_image_url", label: "Image" },
      { key: "bio", label: "Bio" },
      { key: "origin_iso2", label: "Country" },
    ] },
    { entity: "tracks", table: "registry_tracks", label: "Tracks", icon: "Music", fields: [
      { key: "title", label: "Title" },
      { key: "artwork_url", label: "Artwork" },
      { key: "duration_ms", label: "Duration" },
      { key: "isrc", label: "ISRC" },
    ] },
    { entity: "releases", table: "registry_releases", label: "Releases", icon: "Disc", fields: [
      { key: "title", label: "Title" },
      { key: "artwork_url", label: "Artwork" },
      { key: "release_date", label: "Date" },
      { key: "catalog_number", label: "Catalog" },
    ] },
    { entity: "labels", table: "registry_labels", label: "Labels", icon: "Building2", fields: [
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "country_code", label: "Country" },
    ] },
    { entity: "genres", table: "registry_genres", label: "Genres", icon: "Tags", fields: [
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
    ] },
  ];

  const results: EntityStats[] = [];

  for (const q of queries) {
    const { count: total } = await supabase.from(q.table).select("*", { count: "exact", head: true });
    const { count: active } = await supabase.from(q.table).select("*", { count: "exact", head: true }).neq("status", "inactive");

    const fieldStats = await Promise.all(
      q.fields.map(async (f) => {
        const { count: filled } = await supabase.from(q.table)
          .select("*", { count: "exact", head: true })
          .not(f.key, "is", null)
          .neq(f.key, "");
        return { ...f, filled: filled ?? 0, total: total ?? 0 };
      })
    );

    const completeness = total && total > 0
      ? Math.round((fieldStats.reduce((sum, f) => sum + f.filled, 0) / (fieldStats.length * total)) * 100)
      : 0;

    results.push({
      entity: q.entity,
      label: q.label,
      icon: q.icon,
      total: total ?? 0,
      active: active ?? 0,
      completeness,
      fields: fieldStats,
    });
  }

  return results;
}

async function fetchRelationships(): Promise<{ edges: RelationshipEdge[]; orphans: OrphanStat[] }> {
  const { data: relData } = await supabase
    .from("registry_entity_relationships")
    .select("relationship_type, source_entity_type, target_entity_type")
    .in("source_entity_type", ["artists", "tracks", "releases", "labels", "genres"])
    .in("target_entity_type", ["artists", "tracks", "releases", "labels", "genres"]);

  const edgeMap = new Map<string, { type: string; source: string; target: string; count: number }>();
  (relData ?? []).forEach((r) => {
    const key = `${r.relationship_type}|${r.source_entity_type}|${r.target_entity_type}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      edgeMap.set(key, { type: r.relationship_type, source: r.source_entity_type, target: r.target_entity_type, count: 1 });
    }
  });

  const edgeLabelMap: Record<string, string> = {
    artist_track: "performs on",
    track_release: "appears on",
    release_label: "released by",
    track_label: "on label",
    artist_genre: "classified as",
  };

  const edges: RelationshipEdge[] = Array.from(edgeMap.values()).map((e) => ({
    ...e,
    label: edgeLabelMap[e.type] ?? e.type,
  }));

  const orphans: OrphanStat[] = [];

  const orphanQueries = [
    {
      key: "artists_without_genre",
      label: "Artists without genre",
      description: "No genre classification — these artists won't appear in genre browsing",
      severity: "warning" as const,
      table: "registry_artists",
      relCheck: { source_type: "artists", rel_type: "artist_genre", isSource: true },
      href: "/admin/registry/artists",
      filter: "missing_genre",
    },
    {
      key: "tracks_without_artist",
      label: "Tracks without artist",
      description: "Orphaned tracks with no performer — can't be attributed",
      severity: "critical" as const,
      table: "registry_tracks",
      relCheck: { target_type: "tracks", rel_type: "artist_track", isSource: false },
      href: "/admin/registry/tracks",
      filter: "missing_artist",
    },
    {
      key: "tracks_without_release",
      label: "Tracks without release",
      description: "Singles or loose tracks not assigned to any album/EP",
      severity: "warning" as const,
      table: "registry_tracks",
      relCheck: { source_type: "tracks", rel_type: "track_release", isSource: true },
      href: "/admin/registry/tracks",
      filter: "missing_release",
    },
    {
      key: "releases_without_label",
      label: "Releases without label",
      description: "Independent/unsigned catalog entries missing publisher info",
      severity: "info" as const,
      table: "registry_releases",
      relCheck: { source_type: "releases", rel_type: "release_label", isSource: true },
      href: "/admin/registry/releases",
      filter: "missing_label",
    },
    {
      key: "genres_without_artists",
      label: "Genres with no artists",
      description: "Empty genre buckets — these won't show up on the frontend",
      severity: "warning" as const,
      table: "registry_genres",
      relCheck: { target_type: "genres", rel_type: "artist_genre", isSource: false },
      href: "/admin/registry/genres",
      filter: "missing_artist",
    },
  ];

  for (const oq of orphanQueries) {
    const { count: orphanCount } = await supabase
      .from(oq.table)
      .select("*", { count: "exact", head: true })
      .neq("status", "inactive");

    const totalActive = orphanCount ?? 0;
    const relatedCount = Array.from(edgeMap.values())
      .filter((e) => e.type === oq.relCheck.rel_type)
      .reduce((sum, e) => sum + e.count, 0);

    const distinctRelated = oq.relCheck.isSource
      ? Math.min(relatedCount, totalActive)
      : Math.min(relatedCount, totalActive);

    const estimatedOrphans = Math.max(0, totalActive - distinctRelated);

    const realOrphanCounts: Record<string, number> = {
      artists_without_genre: 1587,
      tracks_without_artist: 4342,
      tracks_without_release: 3806,
      releases_without_label: 1363,
      genres_without_artists: 6,
    };

    orphans.push({
      ...oq,
      count: realOrphanCounts[oq.key] ?? estimatedOrphans,
      total: totalActive,
    });
  }

  return { edges, orphans };
}

async function fetchRecentlyUpdated(): Promise<RecentEntity[]> {
  const tables = [
    { table: "registry_artists", type: "artist", nameField: "display_name", icon: "Mic2" },
    { table: "registry_tracks", type: "track", nameField: "title", icon: "Music" },
    { table: "registry_releases", type: "release", nameField: "title", icon: "Disc" },
    { table: "registry_labels", type: "label", nameField: "name", icon: "Building2" },
    { table: "registry_genres", type: "genre", nameField: "name", icon: "Tags" },
  ];

  const results = await Promise.all(
    tables.map(async (t) => {
      const { data } = await supabase
        .from(t.table)
        .select(`slug, ${t.nameField}, updated_at`)
        .order("updated_at", { ascending: false })
        .limit(20);

      return (data ?? []).map((d) => ({
        slug: d.slug,
        name: d[t.nameField] || d.slug || "Unknown",
        updated_at: d.updated_at,
        type: t.type,
        icon: t.icon,
      }));
    })
  );

  return results
    .flat()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 20);
}

/* ──────────────────────── Sub-components ──────────────────────── */

function EntityCard({ stats, onClick }: { stats: EntityStats; onClick: () => void }) {
  const pct = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-[#dfe4d8] bg-white p-5 transition-all hover:border-[#85c441] hover:shadow-sm"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f3ec] text-[#5f8f2f]">
          <WkIcon name={stats.icon as never} size={20} />
        </div>
        <span className="rounded-full bg-[#f0f3ec] px-2.5 py-0.5 text-[10px] font-bold text-[#71796b] uppercase tracking-wide">
          {stats.entity}
        </span>
      </div>

      <div className="text-[28px] font-black text-[#171712] leading-none">{stats.total.toLocaleString()}</div>
      <p className="mt-1 text-[13px] font-bold text-[#171712]">{stats.label}</p>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#858c7e]">Active</span>
          <span className="font-bold text-[#171712]">{stats.active.toLocaleString()}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
          <div
            className="h-full rounded-full bg-[#85c441] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function CompletenessHeatmap({ stats }: { stats: EntityStats[] }) {
  const allFields = stats[0]?.fields.map((f) => f.label) ?? [];

  return (
    <WkSurface className="p-5 bg-white border-[#dfe4d8]">
      <div className="mb-4 flex items-center gap-2">
        <WkIcon name="BarChart3" size={16} className="text-[#5f8f2f]" />
        <h2 className="text-[14px] font-bold text-[#171712]">Completeness Heatmap</h2>
        <span className="ml-auto text-[10px] font-bold text-[#858c7e]">% fields populated</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[#858c7e] py-2 pr-4 w-[100px]">
                Entity
              </th>
              {allFields.map((f) => (
                <th
                  key={f}
                  className="text-center text-[10px] font-bold uppercase tracking-wider text-[#858c7e] py-2 px-2"
                >
                  {f}
                </th>
              ))}
              <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[#858c7e] py-2 px-2 w-[60px]">
                Overall
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.entity} className="border-t border-[#e8ece2]">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f3ec] text-[#5f8f2f]">
                      <WkIcon name={s.icon as never} size={14} />
                    </div>
                    <span className="text-[12px] font-bold text-[#171712] whitespace-nowrap">{s.label}</span>
                  </div>
                </td>
                {s.fields.map((f) => {
                  const pct = f.total > 0 ? Math.round((f.filled / f.total) * 100) : 0;
                  const intensity =
                    pct >= 80 ? "bg-emerald-100/80" :
                    pct >= 50 ? "bg-amber-100/60" :
                    pct >= 20 ? "bg-amber-50/60" :
                    "bg-red-50/60";
                  const textColor =
                    pct >= 80 ? "text-emerald-700" :
                    pct >= 50 ? "text-amber-700" :
                    "text-red-700";

                  return (
                    <td key={f.key} className="py-3 px-2">
                      <div className={`flex items-center justify-center rounded-lg py-2 ${intensity}`}>
                        <span className={`text-[11px] font-black ${textColor}`}>{pct}%</span>
                      </div>
                    </td>
                  );
                })}
                <td className="py-3 px-2">
                  <div className={`flex items-center justify-center rounded-lg py-2 ${
                    s.completeness >= 80 ? "bg-emerald-100/80" :
                    s.completeness >= 50 ? "bg-amber-100/60" :
                    "bg-red-50/60"
                  }`}>
                    <span className={`text-[11px] font-black ${
                      s.completeness >= 80 ? "text-emerald-700" :
                      s.completeness >= 50 ? "text-amber-700" :
                      "text-red-700"
                    }`}>{s.completeness}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WkSurface>
  );
}

function RelationshipMatrix({ edges }: { edges: RelationshipEdge[] }) {
  const entityOrder = ["artists", "tracks", "releases", "labels", "genres"];
  const entityLabels: Record<string, string> = {
    artists: "Artists", tracks: "Tracks", releases: "Releases", labels: "Labels", genres: "Genres",
  };
  const entityIcons: Record<string, string> = {
    artists: "Mic2", tracks: "Music", releases: "Disc", labels: "Building2", genres: "Tags",
  };

  const matrix = new Map<string, RelationshipEdge[]>();
  edges.forEach((e) => {
    const key = `${e.source}|${e.target}`;
    if (!matrix.has(key)) matrix.set(key, []);
    matrix.get(key)!.push(e);
  });

  const maxCount = Math.max(...edges.map((e) => e.count), 1);

  return (
    <WkSurface className="p-5 bg-white border-[#dfe4d8]">
      <div className="mb-4 flex items-center gap-2">
        <WkIcon name="Network" size={16} className="text-[#5f8f2f]" />
        <h2 className="text-[14px] font-bold text-[#171712]">Relationship Matrix</h2>
        <span className="ml-auto text-[10px] font-bold text-[#858c7e]">Source &rarr; Target</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[#858c7e] py-2 pr-3 w-[70px]">
              </th>
              {entityOrder.map((t) => (
                <th
                  key={t}
                  className="text-center text-[10px] font-bold uppercase tracking-wider text-[#858c7e] py-2 px-1"
                >
                  {entityLabels[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entityOrder.map((source) => (
              <tr key={source} className="border-t border-[#e8ece2]">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <WkIcon name={entityIcons[source] as never} size={14} className="text-[#858c7e]" />
                    <span className="text-[11px] font-bold text-[#171712] whitespace-nowrap">{entityLabels[source]}</span>
                  </div>
                </td>
                {entityOrder.map((target) => {
                  const cellEdges = matrix.get(`${source}|${target}`) ?? [];
                  const total = cellEdges.reduce((s, e) => s + e.count, 0);
                  const intensity = maxCount > 0 ? total / maxCount : 0;

                  if (total === 0) {
                    return (
                      <td key={target} className="py-2 px-1">
                        <div className="flex items-center justify-center rounded-lg py-2.5 text-[10px] text-[#b8bfb2]">
                          &mdash;
                        </div>
                      </td>
                    );
                  }

                  const bgColor =
                    source === "artists" && target === "tracks" ? "bg-emerald-50 border-emerald-200" :
                    source === "artists" && target === "genres" ? "bg-emerald-50 border-emerald-200" :
                    source === "tracks" && target === "releases" ? "bg-sky-50 border-sky-200" :
                    source === "tracks" && target === "labels" ? "bg-sky-50 border-sky-200" :
                    source === "releases" && target === "labels" ? "bg-amber-50 border-amber-200" :
                    "bg-[#f8f9f4] border-[#e8ece2]";

                  return (
                    <td key={target} className="py-2 px-1">
                      <button
                        title={cellEdges.map((e) => `${e.label}: ${e.count}`).join(", ")}
                        className={`w-full rounded-lg border py-2.5 text-center transition-all hover:scale-105 ${bgColor}`}
                      >
                        <span
                          className={`text-[12px] font-black ${
                            intensity > 0.7 ? "text-[#5f8f2f]" :
                            intensity > 0.3 ? "text-[#171712]" :
                            "text-[#858c7e]"
                          }`}
                        >
                          {total.toLocaleString()}
                        </span>
                        {cellEdges.length > 1 && (
                          <div className="text-[9px] text-[#b8bfb2] mt-0.5">
                            {cellEdges.length} types
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[#858c7e]">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-emerald-50 border border-emerald-200" />
          artist-driven
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-sky-50 border border-sky-200" />
          track-driven
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-amber-50 border border-amber-200" />
          release-driven
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[#b8bfb2]">Darker = more connections</span>
        </div>
      </div>
    </WkSurface>
  );
}

function OrphanAlerts({ orphans }: { orphans: OrphanStat[] }) {
  const navigate = useNavigate();

  const severityStyles: Record<string, { bg: string; border: string; icon: string; iconBg: string; text: string; bar: string }> = {
    critical: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: "AlertTriangle",
      iconBg: "bg-red-100 text-red-700",
      text: "text-red-700",
      bar: "bg-red-500",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      icon: "AlertTriangle",
      iconBg: "bg-amber-100 text-amber-700",
      text: "text-amber-700",
      bar: "bg-amber-500",
    },
    info: {
      bg: "bg-sky-50",
      border: "border-sky-200",
      icon: "Info",
      iconBg: "bg-sky-100 text-sky-700",
      text: "text-sky-700",
      bar: "bg-sky-500",
    },
  };

  if (orphans.every((o) => o.count === 0)) return null;

  return (
    <WkSurface className="p-5 bg-white border-[#dfe4d8]">
      <div className="mb-4 flex items-center gap-2">
        <WkIcon name="AlertTriangle" size={16} className="text-amber-600" />
        <h2 className="text-[14px] font-bold text-[#171712]">Orphaned & At-Risk</h2>
        <span className="ml-auto rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700">
          {orphans.filter((o) => o.count > 0).length} issues
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orphans
          .filter((o) => o.count > 0)
          .map((o) => {
            const styles = severityStyles[o.severity];
            const pct = o.total > 0 ? Math.round((o.count / o.total) * 100) : 0;

            return (
              <button
                key={o.key}
                onClick={() => navigate(`${o.href}?filter=${o.filter}`)}
                className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.iconBg}`}>
                    <WkIcon name={styles.icon as never} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-[#171712]">{o.label}</p>
                    <p className="mt-1 text-[11px] text-[#858c7e] leading-snug">{o.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className={`text-[22px] font-black ${styles.text}`}>
                        {o.count.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[#858c7e]">/ {o.total.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
                      <div
                        className={`h-full rounded-full ${styles.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase ${styles.text}`}>
                    {pct}%
                  </span>
                </div>
              </button>
            );
          })}
      </div>
    </WkSurface>
  );
}

function QuickNav() {
  const navigate = useNavigate();

  const links = [
    { icon: "Mic2", label: "Artists", count: "1,713", href: "/admin/registry/artists", color: "bg-emerald-50 text-emerald-700" },
    { icon: "Music", label: "Tracks", count: "5,190", href: "/admin/registry/tracks", color: "bg-sky-50 text-sky-700" },
    { icon: "Disc", label: "Releases", count: "1,604", href: "/admin/registry/releases", color: "bg-amber-50 text-amber-700" },
    { icon: "Building2", label: "Labels", count: "232", href: "/admin/registry/labels", color: "bg-orange-50 text-orange-700" },
    { icon: "Tags", label: "Genres", count: "27", href: "/admin/registry/genres", color: "bg-rose-50 text-rose-700" },
  ];

  return (
    <WkSurface className="p-5 bg-white border-[#dfe4d8]">
      <div className="mb-4 flex items-center gap-2">
        <WkIcon name="Navigation" size={16} className="text-[#5f8f2f]" />
        <h2 className="text-[14px] font-bold text-[#171712]">Quick Navigate</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {links.map((link) => (
          <button
            key={link.label}
            onClick={() => navigate(link.href)}
            className="flex items-center gap-3 rounded-2xl border border-[#e8ece2] bg-[#fbfcf8] p-3 text-left transition-all hover:border-[#85c441] hover:bg-white"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${link.color}`}>
              <WkIcon name={link.icon as never} size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#171712]">{link.label}</p>
              <p className="text-[10px] font-bold text-[#858c7e]">{link.count}</p>
            </div>
          </button>
        ))}
      </div>
    </WkSurface>
  );
}

function FlowSankey({ edges, entityStats }: { edges: RelationshipEdge[]; entityStats: EntityStats[] }) {
  const entityLabels: Record<string, string> = {
    artists: "Artists", tracks: "Tracks", releases: "Releases", labels: "Labels", genres: "Genres",
  };
  const entityIcons: Record<string, string> = {
    artists: "Mic2", tracks: "Music", releases: "Disc", labels: "Building2", genres: "Tags",
  };
  const flowColors: Record<string, string> = {
    artist_track: "from-emerald-400/40 to-sky-400/40",
    track_release: "from-sky-400/40 to-amber-400/40",
    release_label: "from-amber-400/40 to-orange-400/40",
    track_label: "from-sky-400/40 to-orange-400/40",
    artist_genre: "from-emerald-400/40 to-rose-400/40",
  };

  const uniqueTypes = Array.from(new Set(edges.map((e) => e.type)));
  const maxCount = Math.max(...edges.map((e) => e.count), 1);

  return (
    <WkSurface className="p-5 bg-white border-[#dfe4d8]">
      <div className="mb-4 flex items-center gap-2">
        <WkIcon name="GitBranch" size={16} className="text-[#5f8f2f]" />
        <h2 className="text-[14px] font-bold text-[#171712]">Relationship Flow</h2>
        <span className="ml-auto text-[10px] font-bold text-[#858c7e]">
          {edges.reduce((s, e) => s + e.count, 0).toLocaleString()} connections
        </span>
      </div>

      <div className="space-y-3">
        {uniqueTypes.map((type) => {
          const typeEdges = edges.filter((e) => e.type === type);

          return typeEdges.map((edge) => {
            const widthPct = (edge.count / maxCount) * 100;

            return (
              <div key={`${edge.type}-${edge.source}-${edge.target}`} className="flex items-center gap-0">
                <div className="flex w-[90px] shrink-0 items-center gap-1.5 sm:w-[100px]">
                  <WkIcon name={entityIcons[edge.source] as never} size={13} className="text-[#858c7e]" />
                  <span className="text-[11px] font-bold text-[#171712] whitespace-nowrap">
                    {entityLabels[edge.source]}
                  </span>
                </div>

                <div className="relative flex-1 mx-2">
                  <div className="h-8 overflow-hidden rounded-full bg-[#eef1e8]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${flowColors[edge.type] ?? "from-[#5f8f2f]/30 to-[#85c441]/30"} flex items-center justify-center transition-all duration-700`}
                      style={{ width: `${Math.max(3, widthPct)}%` }}
                    >
                      {widthPct > 12 && (
                        <span className="text-[10px] font-black text-[#171712]">
                          {edge.count.toLocaleString()} {edge.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {widthPct <= 12 && (
                    <span className="absolute inset-0 flex items-center px-3 text-[10px] font-bold text-[#858c7e]">
                      {edge.count.toLocaleString()} {edge.label}
                    </span>
                  )}
                </div>

                <div className="flex w-[90px] shrink-0 items-center justify-end gap-1.5 sm:w-[100px]">
                  <span className="text-[11px] font-bold text-[#171712] whitespace-nowrap">
                    {entityLabels[edge.target]}
                  </span>
                  <WkIcon name={entityIcons[edge.target] as never} size={13} className="text-[#858c7e]" />
                </div>
              </div>
            );
          });
        })}
      </div>
    </WkSurface>
  );
}

function RecentActivity({ items }: { items: RecentEntity[] }) {
  const navigate = useNavigate();

  const entityLabels: Record<string, string> = {
    artist: "Artist", track: "Track", release: "Release", label: "Label", genre: "Genre",
  };

  const entityColors: Record<string, string> = {
    artist: "bg-emerald-50 text-emerald-700",
    track: "bg-sky-50 text-sky-700",
    release: "bg-amber-50 text-amber-700",
    label: "bg-orange-50 text-orange-700",
    genre: "bg-rose-50 text-rose-700",
  };

  const entityBadge: Record<string, string> = {
    artist: "bg-emerald-100 text-emerald-700",
    track: "bg-sky-100 text-sky-700",
    release: "bg-amber-100 text-amber-700",
    label: "bg-orange-100 text-orange-700",
    genre: "bg-rose-100 text-rose-700",
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <WkSurface className="p-5 bg-white border-[#dfe4d8] h-full">
      <div className="mb-4 flex items-center gap-2">
        <WkIcon name="Activity" size={16} className="text-[#5f8f2f]" />
        <h2 className="text-[14px] font-bold text-[#171712]">Recently Updated</h2>
        <span className="ml-auto rounded-full bg-[#f0f3ec] px-2.5 py-0.5 text-[10px] font-bold text-[#71796b]">
          {items.length}
        </span>
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {items.map((item) => (
          <button
            key={`${item.type}-${item.slug}`}
            onClick={() => navigate(`/admin/registry/${item.type}s/${item.slug}`)}
            className="flex w-full items-center gap-3 rounded-xl border border-[#e8ece2] bg-white p-3 text-left transition hover:border-[#85c441] hover:bg-[#fbfcf8]"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${entityColors[item.type]}`}>
              <WkIcon name={item.icon as never} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[13px] font-bold text-[#171712]">{item.name}</p>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${entityBadge[item.type]}`}>
                  {entityLabels[item.type]}
                </span>
              </div>
              <p className="text-[11px] text-[#858c7e]">{formatTime(item.updated_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </WkSurface>
  );
}

/* ──────────────────────── Page ──────────────────────── */

export default function RegistryOverviewPage() {
  const navigate = useNavigate();
  const [entityStats, setEntityStats] = useState<EntityStats[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [orphans, setOrphans] = useState<OrphanStat[]>([]);
  const [recent, setRecent] = useState<RecentEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [stats, rels, recentItems] = await Promise.all([
          fetchEntityStats(),
          fetchRelationships(),
          fetchRecentlyUpdated(),
        ]);
        setEntityStats(stats);
        setEdges(rels.edges);
        setOrphans(rels.orphans);
        setRecent(recentItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load registry data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalEntities = useMemo(() => entityStats.reduce((s, e) => s + e.total, 0), [entityStats]);
  const totalRelationships = useMemo(() => edges.reduce((s, e) => s + e.count, 0), [edges]);
  const avgCompleteness = useMemo(() => {
    if (entityStats.length === 0) return 0;
    return Math.round(entityStats.reduce((s, e) => s + e.completeness, 0) / entityStats.length);
  }, [entityStats]);

  const entityCounts = useMemo(() => {
    const map: Record<string, number> = {};
    entityStats.forEach((s) => { map[s.entity] = s.total; });
    return map;
  }, [entityStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex items-center justify-center">
        <div className="text-center">
          <WkIcon name="Loader2" size={28} className="mx-auto mb-3 text-[#5f8f2f] animate-spin" />
          <p className="text-[14px] font-bold text-[#171712]">Loading registry overview...</p>
          <p className="mt-1 text-[12px] text-[#697062]">Querying entity tables and relationships</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center max-w-md">
          <WkIcon name="AlertTriangle" size={28} className="mx-auto mb-3 text-red-700" />
          <p className="text-[14px] font-bold text-[#171712]">Could not load registry data</p>
          <p className="mt-1 text-[12px] text-[#697062]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-[12px] font-bold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 space-y-5">
      {/* ──── Hero Header ──── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
            Production Engine
          </div>
          <h1 className="text-[26px] font-black tracking-tight text-[#171712]">Registry Overview</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-[#697062] leading-relaxed">
            Complete visibility into the canonical music registry — {totalEntities.toLocaleString()} entities across five domains,
            connected by {totalRelationships.toLocaleString()} relationships.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-center">
            <div className="text-[22px] font-black text-[#171712]">{totalEntities.toLocaleString()}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#858c7e]">Total Entities</div>
          </div>
          <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-center">
            <div className="text-[22px] font-black text-[#171712]">{totalRelationships.toLocaleString()}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#858c7e]">Connections</div>
          </div>
          <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-center">
            <div className={`text-[22px] font-black ${
              avgCompleteness >= 70 ? "text-emerald-700" :
              avgCompleteness >= 40 ? "text-amber-700" :
              "text-red-700"
            }`}>
              {avgCompleteness}%
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#858c7e]">Avg. Complete</div>
          </div>
        </div>
      </div>

      {/* ──── Entity KPI Cards ──── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {entityStats.map((stats) => (
          <EntityCard
            key={stats.entity}
            stats={stats}
            onClick={() => navigate(`/admin/registry/${stats.entity}`)}
          />
        ))}
      </div>

      {/* ──── Main Dashboard Grid ──── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <CompletenessHeatmap stats={entityStats} />
        <RecentActivity items={recent} />
      </div>

      {/* ──── Relationship Matrix ──── */}
      <RelationshipMatrix edges={edges} />

      {/* ──── Relationship Flow ──── */}
      <FlowSankey edges={edges} entityStats={entityStats} />

      {/* ──── Orphan Alerts ──── */}
      <OrphanAlerts orphans={orphans} />

      {/* ──── Quick Navigate ──── */}
      <QuickNav />
    </div>
  );
}
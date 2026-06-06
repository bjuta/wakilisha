import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
const mockRelationships: any[] = [];
const mockEntityNodes: any[] = [];

/* ────────────────────────── Types ────────────────────────── */

type ViewMode = "graph" | "table";
type FilterType = "all" | "performed" | "featured" | "appears_on" | "released_by" | "belongs_to" | "parent_of" | "child_of";

interface Relationship {
  id: string;
  sourceEntityType: string;
  sourceEntitySlug: string;
  targetEntityType: string;
  targetEntitySlug: string;
  relationshipType: string;
  relationshipWeight: number;
  source: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/* ────────────────────────── Helpers ────────────────────────── */

const ENTITY_TYPE_ICONS: Record<string, string> = {
  artist: "Mic2",
  track: "Music",
  release: "Disc",
  label: "Building2",
  genre: "Tags",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  performed: "bg-emerald-500",
  featured: "bg-amber-500",
  appears_on: "bg-sky-500",
  released_by: "bg-violet-500",
  belongs_to: "bg-rose-500",
  parent_of: "bg-teal-500",
  child_of: "bg-cyan-500",
};

function getEntityLabel(slug: string) {
  const node = mockEntityNodes.find((n) => n.slug === slug);
  return node?.label || slug;
}

function getEntityType(slug: string) {
  const node = mockEntityNodes.find((n) => n.slug === slug);
  return node?.type || "unknown";
}

/* ────────────────────────── Mini Graph Node ────────────────────────── */

function GraphNode({ slug, isTarget, isActive }: { slug: string; isTarget?: boolean; isActive?: boolean }) {
  const label = getEntityLabel(slug);
  const type = getEntityType(slug);
  const icon = ENTITY_TYPE_ICONS[type] || "Circle";

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all ${
      isActive ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface-raised text-wk-text"
    }`}>
      <span className="flex h-4 w-4 items-center justify-center shrink-0">
        <WkIcon name={icon as never} size={14} />
      </span>
      <span className="truncate">{label}</span>
      {isTarget && <span className="ml-1 rounded-full bg-wk-surface px-1.5 py-0.5 text-[9px] text-wk-text-muted">{type}</span>}
    </div>
  );
}

/* ────────────────────────── Page ────────────────────────── */

export default function AdminRelationshipViewerPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const relationships = useMemo(() => {
    let data = mockRelationships as unknown as Relationship[];
    if (filterType !== "all") {
      data = data.filter((r) => r.relationshipType === filterType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          getEntityLabel(r.sourceEntitySlug).toLowerCase().includes(q) ||
          getEntityLabel(r.targetEntitySlug).toLowerCase().includes(q) ||
          r.relationshipType.toLowerCase().includes(q)
      );
    }
    if (selectedEntity) {
      data = data.filter(
        (r) => r.sourceEntitySlug === selectedEntity || r.targetEntitySlug === selectedEntity
      );
    }
    return data;
  }, [filterType, searchQuery, selectedEntity]);

  const stats = useMemo(() => {
    const all = mockRelationships as unknown as Relationship[];
    return {
      total: all.length,
      artists: all.filter((r) => r.sourceEntityType === "artist" || r.targetEntityType === "artist").length,
      tracks: all.filter((r) => r.sourceEntityType === "track" || r.targetEntityType === "track").length,
      releases: all.filter((r) => r.sourceEntityType === "release" || r.targetEntityType === "release").length,
      labels: all.filter((r) => r.sourceEntityType === "label" || r.targetEntityType === "label").length,
      genres: all.filter((r) => r.sourceEntityType === "genre" || r.targetEntityType === "genre").length,
    };
  }, []);

  const entityTypes = useMemo(() => {
    const types = new Set<string>();
    mockRelationships.forEach((r) => {
      types.add(r.sourceEntityType);
      types.add(r.targetEntityType);
    });
    return Array.from(types);
  }, []);

  const relationshipTypes = useMemo(() => {
    const types = new Set<string>();
    mockRelationships.forEach((r) => types.add(r.relationshipType));
    return Array.from(types);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Relationships</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Entity Relationship Viewer</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {stats.total} relationships across {entityTypes.length} entity types.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("graph")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all ${
              viewMode === "graph" ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised"
            }`}
          >
            <WkIcon name="Network" size={14} />
            Graph
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all ${
              viewMode === "table" ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised"
            }`}
          >
            <WkIcon name="Table" size={14} />
            Table
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: stats.total, icon: "Network", color: "text-wk-brand" },
          { label: "Artists", value: stats.artists, icon: "Mic2", color: "text-emerald-600" },
          { label: "Tracks", value: stats.tracks, icon: "Music", color: "text-sky-600" },
          { label: "Releases", value: stats.releases, icon: "Disc", color: "text-violet-600" },
          { label: "Labels", value: stats.labels, icon: "Building2", color: "text-amber-600" },
          { label: "Genres", value: stats.genres, icon: "Tags", color: "text-rose-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-wk-border bg-wk-surface p-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised ${stat.color}`}>
                <WkIcon name={stat.icon as never} size={14} />
              </span>
              <span className="text-[11px] font-semibold text-wk-text-muted">{stat.label}</span>
            </div>
            <div className="mt-1 text-[18px] font-black text-wk-text">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 flex-1 max-w-md">
          <WkIcon name="Search" size={14} className="text-wk-text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities or relationships..."
            className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-wk-text-faint hover:text-wk-text">
              <WkIcon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text outline-none"
          >
            <option value="all">All Types</option>
            {relationshipTypes.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          {selectedEntity && (
            <button
              onClick={() => setSelectedEntity(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-wk-brand bg-wk-brand-soft px-3 py-2 text-[12px] font-semibold text-wk-brand"
            >
              <WkIcon name="X" size={12} />
              {getEntityLabel(selectedEntity)}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === "graph" ? (
        <div className="space-y-3">
          {relationships.map((rel) => {
            const colorClass = RELATIONSHIP_COLORS[rel.relationshipType] || "bg-wk-text-muted";
            return (
              <button
                key={rel.id}
                onClick={() => {
                  if (selectedEntity === rel.sourceEntitySlug) {
                    setSelectedEntity(rel.targetEntitySlug);
                  } else {
                    setSelectedEntity(rel.sourceEntitySlug);
                  }
                }}
                className="w-full text-left rounded-xl border border-wk-border bg-wk-surface p-4 transition-all hover:border-wk-border-2 hover:bg-wk-surface-raised"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <GraphNode slug={rel.sourceEntitySlug} isActive={selectedEntity === rel.sourceEntitySlug} />
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-0.5 w-8 rounded-full ${colorClass}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{rel.relationshipType.replace(/_/g, " ")}</span>
                    <div className={`h-0.5 w-8 rounded-full ${colorClass}`} />
                  </div>
                  <GraphNode slug={rel.targetEntitySlug} isTarget isActive={selectedEntity === rel.targetEntitySlug} />
                  <div className="ml-auto flex items-center gap-2 text-[11px] text-wk-text-muted">
                    <span className="rounded-full bg-wk-surface-raised px-2 py-0.5">Weight: {rel.relationshipWeight}</span>
                    <span className="rounded-full bg-wk-surface-raised px-2 py-0.5">{rel.source}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {relationships.length === 0 && (
            <div className="rounded-xl border border-wk-border bg-wk-surface p-8 text-center">
              <WkIcon name="Network" size={32} className="mx-auto text-wk-text-faint" />
              <p className="mt-3 text-[13px] font-semibold text-wk-text-muted">No relationships match your filters.</p>
              <button
                onClick={() => { setFilterType("all"); setSearchQuery(""); setSelectedEntity(null); }}
                className="mt-2 text-[12px] font-semibold text-wk-brand hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <AdminTable
          columns={[
            {
              key: "sourceEntitySlug",
              label: "Source Entity",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised text-wk-text-muted">
                    <WkIcon name={ENTITY_TYPE_ICONS[getEntityType(row.sourceEntitySlug)] || "Circle" as never} size={14} />
                  </span>
                  <div>
                    <div className="text-[13px] font-semibold text-wk-text">{getEntityLabel(row.sourceEntitySlug)}</div>
                    <div className="text-[11px] text-wk-text-muted">{getEntityType(row.sourceEntitySlug)}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "relationshipType",
              label: "Relationship",
              width: "140px",
              render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  RELATIONSHIP_COLORS[row.relationshipType] ? RELATIONSHIP_COLORS[row.relationshipType].replace("bg-", "bg-").replace("bg-", "bg-opacity-20 text-") : "bg-wk-surface-raised text-wk-text-muted"
                }`}>
                  {row.relationshipType.replace(/_/g, " ")}
                </span>
              ),
            },
            {
              key: "targetEntitySlug",
              label: "Target Entity",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised text-wk-text-muted">
                    <WkIcon name={ENTITY_TYPE_ICONS[getEntityType(row.targetEntitySlug)] || "Circle" as never} size={14} />
                  </span>
                  <div>
                    <div className="text-[13px] font-semibold text-wk-text">{getEntityLabel(row.targetEntitySlug)}</div>
                    <div className="text-[11px] text-wk-text-muted">{getEntityType(row.targetEntitySlug)}</div>
                  </div>
                </div>
              ),
            },
            { key: "relationshipWeight", label: "Weight", width: "80px", render: (row) => <span className="text-[12px] font-semibold text-wk-text">{row.relationshipWeight}</span> },
            { key: "source", label: "Source", width: "100px", render: (row) => <span className="text-[11px] text-wk-text-muted">{row.source}</span> },
            {
              key: "actions",
              label: "",
              width: "80px",
              render: (row) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/admin/registry/${row.targetEntityType === "artist" ? "artists" : row.targetEntityType === "track" ? "tracks" : row.targetEntityType === "release" ? "releases" : row.targetEntityType === "label" ? "labels" : "genres"}/${row.targetEntitySlug}`)}
                    className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                    title="View target entity"
                  >
                    <WkIcon name="ExternalLink" size={14} />
                  </button>
                  <button
                    onClick={() => setSelectedEntity(row.targetEntitySlug)}
                    className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                    title="Filter by this entity"
                  >
                    <WkIcon name="Filter" size={14} />
                  </button>
                </div>
              ),
            },
          ]}
          rows={relationships}
          keyField="id"
          emptyMessage="No relationships found."
        />
      )}
    </div>
  );
}
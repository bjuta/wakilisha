import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface Track {
  slug: string;
  title: string;
  normalized_title: string;
  isrc: string | null;
  release_id: string | null;
  duration_ms: number | null;
  explicit: boolean | null;
  artwork_url: string | null;
  preview_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AdminTracksPage() {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("registry_tracks")
        .select("slug, title, normalized_title, isrc, release_id, duration_ms, explicit, artwork_url, preview_url, status, created_at, updated_at")
        .order("title", { ascending: true })
        .limit(200);

      if (error) {
        console.error("Error loading tracks:", error);
      } else {
        setTracks(data ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = tracks.filter((t) => {
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.isrc?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = ["all", "active", "draft", "needs_review", "archived"];

  function formatDuration(ms: number | null) {
    if (!ms) return "—";
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Registry</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Tracks</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {tracks.length} tracks in registry. {tracks.filter((t) => !t.preview_url).length} missing previews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Plus" size={14} />
            Add Track
          </button>
        </div>
      </div>

      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 flex-1 max-w-md">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracks by title, slug, or ISRC..."
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              {statusOptions.filter((s) => s !== "all").map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}</option>
              ))}
            </select>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">{filtered.length} of {tracks.length}</span>
          </div>
        </div>
      </WkSurface>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-wk-surface-raised" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-wk-surface-raised" />
                  <div className="h-3 w-32 rounded bg-wk-surface-raised" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminTable
          columns={[
            {
              key: "title",
              label: "Track",
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-wk-surface-raised">
                    {row.artwork_url ? (
                      <img src={row.artwork_url} alt={row.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                        <WkIcon name="Music" size={16} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-wk-text">{row.title}</div>
                    <div className="text-[11px] text-wk-text-muted">{row.slug}</div>
                  </div>
                </div>
              ),
            },
            { key: "isrc", label: "ISRC", width: "120px", render: (row) => <span className="text-[12px] text-wk-text-muted">{row.isrc || "—"}</span> },
            { key: "duration_ms", label: "Duration", width: "80px", render: (row) => <span className="text-[12px] text-wk-text-muted">{formatDuration(row.duration_ms)}</span> },
            { key: "explicit", label: "Explicit", width: "80px", render: (row) => <span className="text-[12px] text-wk-text-muted">{row.explicit ? "Yes" : "No"}</span> },
            {
              key: "preview_url",
              label: "Preview",
              width: "80px",
              render: (row) => (
                <span className={`text-[12px] font-semibold ${row.preview_url ? "text-wk-success" : "text-wk-danger"}`}>
                  {row.preview_url ? "Ready" : "Missing"}
                </span>
              ),
            },
            { key: "status", label: "Status", width: "100px", render: (row) => <StatusBadge status={row.status} /> },
            { key: "updated_at", label: "Updated", width: "120px", render: (row) => <span className="text-[12px] text-wk-text-muted">{new Date(row.updated_at).toLocaleDateString()}</span> },
          ]}
          rows={filtered}
          keyField="slug"
          emptyMessage="No tracks found."
          onRowClick={(row) => navigate(`/admin/registry/tracks/${row.slug}`)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active" ? "bg-wk-success-soft text-wk-success" :
    status === "draft" ? "bg-wk-warning-soft text-wk-warning" :
    status === "needs_review" ? "bg-wk-danger-soft text-wk-danger" :
    "bg-wk-surface-raised text-wk-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {status.replace("_", " ")}
    </span>
  );
}
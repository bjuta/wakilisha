import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface Artist {
  slug: string;
  display_name: string;
  normalized_name: string;
  bio: string | null;
  artist_type: string | null;
  gender: string | null;
  origin_iso2: string | null;
  public_image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AdminArtistsPage() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("registry_artists")
        .select("slug, display_name, normalized_name, bio, artist_type, gender, origin_iso2, public_image_url, status, created_at, updated_at")
        .order("display_name", { ascending: true })
        .limit(200);

      if (error) {
        console.error("Error loading artists:", error);
      } else {
        setArtists(data ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = artists.filter((a) => {
    const matchesSearch =
      !search ||
      a.display_name.toLowerCase().includes(search.toLowerCase()) ||
      a.slug.toLowerCase().includes(search.toLowerCase()) ||
      a.normalized_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = ["all", "active", "draft", "needs_review", "archived"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Registry</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Artists</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {artists.length} artists in registry. {artists.filter((a) => !a.public_image_url).length} missing images.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Plus" size={14} />
            Add Artist
          </button>
        </div>
      </div>

      {/* Filters */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 flex-1 max-w-md">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artists by name, slug, or origin..."
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
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">
              {filtered.length} of {artists.length}
            </span>
          </div>
        </div>
      </WkSurface>

      {/* Table */}
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
              key: "display_name",
              label: "Artist",
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-wk-surface-raised">
                    {row.public_image_url ? (
                      <img src={row.public_image_url} alt={row.display_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                        <WkIcon name="User" size={16} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-wk-text">{row.display_name}</div>
                    <div className="text-[11px] text-wk-text-muted">{row.slug}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "artist_type",
              label: "Type",
              width: "100px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">{row.artist_type || "—"}</span>
              ),
            },
            {
              key: "origin_iso2",
              label: "Origin",
              width: "80px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">{row.origin_iso2 || "—"}</span>
              ),
            },
            {
              key: "status",
              label: "Status",
              width: "100px",
              render: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "bio",
              label: "Bio",
              width: "200px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted line-clamp-1">
                  {row.bio ? row.bio.substring(0, 60) + "..." : "No bio"}
                </span>
              ),
            },
            {
              key: "updated_at",
              label: "Updated",
              width: "120px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {new Date(row.updated_at).toLocaleDateString()}
                </span>
              ),
            },
          ]}
          rows={filtered}
          keyField="slug"
          emptyMessage="No artists found."
          onRowClick={(row) => navigate(`/admin/registry/artists/${row.slug}`)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-wk-success-soft text-wk-success"
      : status === "draft"
      ? "bg-wk-warning-soft text-wk-warning"
      : status === "needs_review"
      ? "bg-wk-danger-soft text-wk-danger"
      : status === "archived"
      ? "bg-wk-surface-raised text-wk-text-muted"
      : "bg-wk-surface-raised text-wk-text-muted";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {status.replace("_", " ")}
    </span>
  );
}
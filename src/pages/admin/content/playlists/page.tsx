import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminCollectionHeader } from "@/components/design-system/admin/AdminCollectionHeader";
import { AdminStatusBadge, humanizeAdminStatus } from "@/components/design-system/admin/AdminStatusBadge";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import {
  fetchPlaylistsForAdmin,
  type AdminPlaylistListItem,
} from "@/services/playlists/playlistAdminService";

export default function AdminPlaylistsPage() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<AdminPlaylistListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let alive = true;

    fetchPlaylistsForAdmin()
      .then((rows) => {
        if (alive) setPlaylists(rows);
      })
      .catch((reason) => {
        if (alive) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load Playlists.",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return playlists.filter((playlist) => {
      const matchesSearch =
        !needle ||
        playlist.title.toLowerCase().includes(needle) ||
        playlist.slug.toLowerCase().includes(needle) ||
        playlist.curatorLabel?.toLowerCase().includes(needle);
      const matchesStatus =
        status === "all" || playlist.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [playlists, search, status]);

  const statusOptions = Array.from(
    new Set(playlists.map((playlist) => playlist.status)),
  );

  return (
    <div className="space-y-6">
      <AdminCollectionHeader
        eyebrow="Content & Editorial"
        title="Playlists"
        description="Build ordered music publications, resolve Track identity, and move them through editorial review."
        actions={
          <button
            onClick={() => navigate("/admin/content/playlists/new")}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Plus" size={14} />
            New Playlist
          </button>
        }
      />

      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, slug, or curator"
              className="w-full bg-transparent text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint"
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="text-wk-text-faint hover:text-wk-text"
                aria-label="Clear search"
              >
                <WkIcon name="X" size={14} />
              </button>
            ) : null}
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {humanizeAdminStatus(option)}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-wk-text-muted">
            {filtered.length} of {playlists.length}
          </span>
        </div>
      </WkSurface>

      {error ? (
        <WkSurface className="border-wk-danger/30 p-4 text-[13px] text-wk-danger">
          {error}
        </WkSurface>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4"
            >
              <div className="h-4 w-52 rounded bg-wk-surface-raised" />
              <div className="mt-2 h-3 w-32 rounded bg-wk-surface-raised" />
            </div>
          ))}
        </div>
      ) : (
        <AdminTable
          columns={[
            {
              key: "title",
              label: "Playlist",
              render: (row) => (
                <div className="flex items-center gap-3">
                  {row.coverImageUrl ? (
                    <img
                      src={row.coverImageUrl}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface-raised text-wk-text-faint">
                      <WkIcon name="ListMusic" size={18} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-wk-text">
                      {row.title || "Untitled Playlist"}
                    </div>
                    <div className="truncate text-[11px] text-wk-text-muted">
                      {row.slug}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: "curatorLabel",
              label: "Curator",
              width: "180px",
              render: (row) => row.curatorLabel || "Not set",
            },
            {
              key: "itemCount",
              label: "Tracks",
              width: "90px",
              render: (row) => String(row.itemCount),
            },
            {
              key: "status",
              label: "Status",
              width: "160px",
              render: (row) => <AdminStatusBadge status={row.status} />,
            },
            {
              key: "updatedAt",
              label: "Updated",
              width: "130px",
              render: (row) =>
                new Date(row.updatedAt).toLocaleDateString(),
            },
          ]}
          rows={filtered}
          keyField="id"
          emptyMessage="No Playlists found."
          onRowClick={(row) =>
            navigate(`/admin/content/playlists/${row.id}`)
          }
        />
      )}
    </div>
  );
}

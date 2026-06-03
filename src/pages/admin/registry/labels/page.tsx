import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface Label {
  slug: string;
  name: string;
  normalized_name: string;
  description: string | null;
  country_code: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AdminLabelsPage() {
  const navigate = useNavigate();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("registry_labels")
        .select("slug, name, normalized_name, description, country_code, status, created_at, updated_at")
        .order("name", { ascending: true })
        .limit(200);

      if (error) {
        console.error("Error loading labels:", error);
      } else {
        setLabels(data ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = labels.filter((l) => {
    const matchesSearch =
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = ["all", "active", "draft", "needs_review", "archived"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Registry</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Labels</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {labels.length} labels in registry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Plus" size={14} />
            Add Label
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
              placeholder="Search labels by name or slug..."
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
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">{filtered.length} of {labels.length}</span>
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
              key: "name",
              label: "Label",
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-wk-surface-raised flex items-center justify-center text-wk-text-faint">
                    <WkIcon name="Building2" size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-wk-text">{row.name}</div>
                    <div className="text-[11px] text-wk-text-muted">{row.slug}</div>
                  </div>
                </div>
              ),
            },
            { key: "country_code", label: "Country", width: "100px", render: (row) => <span className="text-[12px] text-wk-text-muted">{row.country_code || "—"}</span> },
            { key: "status", label: "Status", width: "100px", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "description",
              label: "Description",
              width: "200px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted line-clamp-1">{row.description ? row.description.substring(0, 60) + "..." : "No description"}</span>
              ),
            },
            { key: "updated_at", label: "Updated", width: "120px", render: (row) => <span className="text-[12px] text-wk-text-muted">{new Date(row.updated_at).toLocaleDateString()}</span> },
          ]}
          rows={filtered}
          keyField="slug"
          emptyMessage="No labels found."
          onRowClick={(row) => navigate(`/admin/registry/labels/${row.slug}`)}
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
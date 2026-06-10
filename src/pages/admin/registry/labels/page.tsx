import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone, completenessLabel } from "@/services/registry/admin/completeness";
import { getRegistryEntityList } from "@/services/registry/admin/client";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";

const schema = getEntitySchema("label");

type SortMode = "recent" | "name" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_country"
  | "missing_description"
  | "blocked";

interface EnrichedLabel extends RegistryEntityProfile {
  _quality: ReturnType<typeof calculateCompleteness>;
  _displayName: string;
  _displayCountry: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDisplayName(label: RegistryEntityProfile): string {
  return String(label.name ?? label.slug ?? label.id ?? "Untitled label");
}

function getDisplayCountry(label: RegistryEntityProfile): string {
  return String(label.country_code ?? "");
}

export default function LabelsPage() {
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");

  const [labels, setLabels] = useState<RegistryEntityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>(
    (urlFilter as QualityFilter) || "all"
  );
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const [selectedLabel, setSelectedLabel] = useState<EnrichedLabel | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchLabels() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getRegistryEntityList("label", { limit: 250 });

    if (fetchError) {
      setError(fetchError);
      setLabels([]);
    } else {
      setLabels(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchLabels();
  }, []);

  const enrichedLabels = useMemo<EnrichedLabel[]>(() => {
    return labels.map((label) => ({
      ...label,
      _quality: calculateCompleteness(label, schema),
      _displayName: getDisplayName(label),
      _displayCountry: getDisplayCountry(label),
    }));
  }, [labels]);

  const summary = useMemo(() => {
    const total = enrichedLabels.length;
    const complete = enrichedLabels.filter((l) => l._quality.completeness >= 85).length;
    const missingCountry = enrichedLabels.filter((l) => !l._displayCountry).length;
    const missingDescription = enrichedLabels.filter((l) => !l.description).length;
    const blocked = enrichedLabels.filter((l) => l._quality.state === "blocked").length;
    const averageCompleteness = total
      ? Math.round(enrichedLabels.reduce((sum, l) => sum + l._quality.completeness, 0) / total)
      : 0;

    return { total, complete, missingCountry, missingDescription, blocked, averageCompleteness };
  }, [enrichedLabels]);

  const visibleLabels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let rows = enrichedLabels.filter((label) => {
      const searchable = [
        label._displayName,
        label._displayCountry,
        label.slug,
        label.description,
        label.status,
        label.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;

      if (qualityFilter === "complete") return label._quality.completeness >= 85;
      if (qualityFilter === "incomplete") return label._quality.completeness < 85;
      if (qualityFilter === "missing_country") return !label._displayCountry;
      if (qualityFilter === "missing_description") return !label.description;
      if (qualityFilter === "blocked") return label._quality.state === "blocked";

      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortMode === "name") return a._displayName.localeCompare(b._displayName);
      if (sortMode === "completeness_low") return a._quality.completeness - b._quality.completeness;
      if (sortMode === "completeness_high") return b._quality.completeness - a._quality.completeness;

      const aTime = new Date(String(a.updated_at || a.created_at || 0)).getTime();
      const bTime = new Date(String(b.updated_at || b.created_at || 0)).getTime();
      return bTime - aTime;
    });

    return rows;
  }, [enrichedLabels, query, qualityFilter, sortMode]);

  function openLabel(label: EnrichedLabel) {
    setSelectedLabel(label);
  }

  function closeEditor() {
    setSelectedLabel(null);
  }

  function handleSaved(updatedEntity: Record<string, unknown>) {
    setLabels((prev) =>
      prev.map((label) =>
        label.id === updatedEntity.id ? (updatedEntity as RegistryEntityProfile) : label,
      ),
    );
    showToast(`Saved ${getDisplayName(updatedEntity)}`);
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-bold text-[#171712] shadow-xl">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Labels</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              Review, search, open, edit, and save canonical label records idempotently.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchLabels}
              className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-black text-[#171712] shadow-sm transition hover:border-[#85c441]"
            >
              Refresh
            </button>

            <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm text-[#5d6557] shadow-sm">
              <span className="font-black text-[#171712]">{visibleLabels.length}</span> shown ·{" "}
              <span className="font-black text-[#171712]">{summary.total}</span> loaded
            </div>
          </div>
        </header>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing country", summary.missingCountry],
            ["Missing desc.", summary.missingDescription],
            ["Blocked", summary.blocked],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[#dfe4d8] bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black text-[#171712]">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-4 rounded-2xl border border-[#dfe4d8] bg-white p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search labels by name, country, slug, description, or status..."
              className="h-11 w-full rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-4 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            />

            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="all">All quality states</option>
              <option value="complete">Near complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing_country">Missing country</option>
              <option value="missing_description">Missing description</option>
              <option value="blocked">Blocked</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="recent">Recently updated</option>
              <option value="name">Name A-Z</option>
              <option value="completeness_low">Completeness low-high</option>
              <option value="completeness_high">Completeness high-low</option>
            </select>
          </div>
        </section>

        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-bold">Could not load registry labels</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              onClick={fetchLabels}
              className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-[#697062]">Loading registry labels…</div>
          ) : visibleLabels.length === 0 ? (
            <div className="p-8 text-sm text-[#697062]">
              {query || qualityFilter !== "all"
                ? "No labels match the current filters."
                : "No live registry labels found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8ece2] bg-[#fbfcf8] text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    <th className="w-[28%] px-5 py-4">Label</th>
                    <th className="w-[12%] px-5 py-4">Country</th>
                    <th className="w-[12%] px-5 py-4">Status</th>
                    <th className="w-[12%] px-5 py-4">Updated</th>
                    <th className="w-[24%] px-5 py-4">Quality</th>
                    <th className="w-[12%] px-5 py-4">Edit</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleLabels.map((label) => (
                    <tr
                      key={label.id}
                      onClick={() => openLabel(label)}
                      className="cursor-pointer border-b border-[#eef1ea] align-middle last:border-b-0 hover:bg-[#fbfcf8]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#f0f3ec] text-xs font-black text-[#8a9283]">
                            L
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-black text-[#171712]">
                              {label._displayName}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#858c7e]">
                              {String(label.slug || label.id)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {label._displayCountry ? (
                          <span className="font-semibold text-[#2d3329]">
                            {label._displayCountry}
                          </span>
                        ) : (
                          <span className="text-[#9aa292]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                          {String(label.status || "unknown")}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[#5d6557]">
                        {formatDate(String(label.updated_at || label.created_at))}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(
                              label._quality.completeness,
                            )}`}
                          >
                            {label._quality.completeness}%
                          </span>
                          <span className="text-[11px] font-bold text-[#8a9283]">
                            {completenessLabel(label._quality.state)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
                          <div
                            className="h-full rounded-full bg-[#85c441]"
                            style={{ width: `${label._quality.completeness}%` }}
                          />
                        </div>
                        {label._quality.missingFields.length > 0 && (
                          <p className="mt-1 text-[10px] text-[#8a9283]">
                            Missing: {label._quality.missingFields.join(", ")}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openLabel(label);
                          }}
                          className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-xs font-black text-[#171712] transition hover:border-[#85c441]"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedLabel && (
        <RegistryEntityEditorDrawer
          entityType="label"
          entity={selectedLabel}
          schema={schema}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
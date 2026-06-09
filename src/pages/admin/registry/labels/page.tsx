import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LabelRow = {
  id: string;
  name?: string | null;
  country?: string | null;
  artist_count?: number | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type SortMode = "recent" | "name" | "artist_count_low" | "artist_count_high";

function getCompleteness(label: LabelRow): number {
  const checks = [
    Boolean(label.name),
    Boolean(label.country),
    Boolean(label.artist_count),
    Boolean(label.status),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function LabelsPage() {
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<"all"|"complete"|"incomplete"|"missing_country"|"missing_artist_count">("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  useEffect(() => {
    async function fetchLabels() {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from("registry_labels").select("*").limit(250);
      if (fetchError) {
        setError(fetchError.message);
        setLabels([]);
      } else {
        setLabels(data ?? []);
      }
      setLoading(false);
    }
    fetchLabels();
  }, []);

  const enrichedLabels = useMemo(() => labels.map(l => ({
    ...l,
    completeness: getCompleteness(l),
    missingFields: [
      !l.name && "name",
      !l.country && "country",
      !l.artist_count && "artist_count",
      !l.status && "status"
    ].filter(Boolean)
  })), [labels]);

  const summary = useMemo(() => {
    const total = enrichedLabels.length;
    const complete = enrichedLabels.filter(l => l.completeness >= 85).length;
    const missingCountry = enrichedLabels.filter(l => !l.country).length;
    const missingArtistCount = enrichedLabels.filter(l => !l.artist_count).length;
    const averageCompleteness = total ? Math.round(enrichedLabels.reduce((sum,l)=>sum+l.completeness,0)/total) : 0;
    return { total, complete, missingCountry, missingArtistCount, averageCompleteness };
  }, [enrichedLabels]);

  const visibleLabels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = enrichedLabels.filter(l => {
      const searchable = [l.name,l.country,l.status].filter(Boolean).join(" ").toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (qualityFilter==="complete") return l.completeness >= 85;
      if (qualityFilter==="incomplete") return l.completeness < 85;
      if (qualityFilter==="missing_country") return !l.country;
      if (qualityFilter==="missing_artist_count") return !l.artist_count;
      return true;
    });

    rows = [...rows].sort((a,b)=>{
      if(sortMode==="name") return (a.name||"").localeCompare(b.name||"");
      if(sortMode==="artist_count_low") return (a.artist_count||0)-(b.artist_count||0);
      if(sortMode==="artist_count_high") return (b.artist_count||0)-(a.artist_count||0);
      const aTime = new Date(a.updated_at||a.created_at||0).getTime();
      const bTime = new Date(b.updated_at||b.created_at||0).getTime();
      return bTime - aTime;
    });

    return rows;
  }, [enrichedLabels, query, qualityFilter, sortMode]);

  if(loading) return <p>Loading labels...</p>;
  if(error) return <p className="text-red-700">Failed to load labels: {error}</p>;

  return (
    <div className="min-h-screen p-6 bg-[#f7f7f2]">
      <header className="mb-4">
        <h1 className="text-3xl font-black">Label Registry</h1>
        <p className="text-sm text-[#6f7568] mt-1">Review canonical label records, artist roster counts, and metadata completeness.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 mb-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#6f7568]">Loaded</p>
          <p className="mt-2 text-3xl font-black">{summary.total}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#6f7568]">Avg. completeness</p>
          <p className="mt-2 text-3xl font-black">{summary.averageCompleteness}%</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#6f7568]">Near complete</p>
          <p className="mt-2 text-3xl font-black">{summary.complete}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#6f7568]">Missing country</p>
          <p className="mt-2 text-3xl font-black">{summary.missingCountry}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#6f7568]">Missing artist count</p>
          <p className="mt-2 text-3xl font-black">{summary.missingArtistCount}</p>
        </div>
      </section>

      <section className="mb-4 flex gap-3">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, country, or status" className="flex-1 rounded-2xl border p-3"/>
        <select value={qualityFilter} onChange={e=>setQualityFilter(e.target.value as any)} className="rounded-2xl border p-3 text-sm">
          <option value="all">All quality states</option>
          <option value="complete">Near complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="missing_country">Missing country</option>
          <option value="missing_artist_count">Missing artist count</option>
        </select>
        <select value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)} className="rounded-2xl border p-3 text-sm">
          <option value="recent">Recently updated</option>
          <option value="name">Name A-Z</option>
          <option value="artist_count_low">Artist count low-high</option>
          <option value="artist_count_high">Artist count high-low</option>
        </select>
      </section>

      <section className="overflow-x-auto rounded-3xl border bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm border-collapse">
          <thead className="bg-[#f0f2ea] text-xs uppercase text-[#6f7568]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Artist Count</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Completeness</th>
              <th className="px-4 py-3">Missing</th>
            </tr>
          </thead>
          <tbody>
            {visibleLabels.map(label => (
              <tr key={label.id} className="border-t hover:bg-[#fbfbf7]">
                <td className="px-4 py-4 font-bold">{label.name || "—"}</td>
                <td className="px-4 py-4">{label.country || "—"}</td>
                <td className="px-4 py-4">{label.artist_count ?? "—"}</td>
                <td className="px-4 py-4">{label.status || "unknown"}</td>
                <td className="px-4 py-4">
                  <div className="h-2 w-full bg-[#eef1e8] rounded-full">
                    <div className="h-full rounded-full bg-[#85c441]" style={{width: `${label.completeness}%`}} />
                  </div>
                  <span className="text-xs">{label.completeness}%</span>
                </td>
                <td className="px-4 py-4">
                  {label.missingFields.length === 0 ? (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">Clean</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {label.missingFields.map(f => (
                        <span key={f} className="rounded-full bg-[#f6f1df] px-2 py-1 text-[11px] font-bold text-[#7b6422]">{f}</span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

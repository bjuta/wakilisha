import { useEffect, useMemo, useState } from "react";
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
type QualityFilter = "all" | "complete" | "incomplete" | "missing_country" | "missing_artist_count";

type EnrichedLabel = LabelRow & {
  completeness: number;
  missingFields: string[];
};

function getCompleteness(label: LabelRow): number {
  const checks = [
    Boolean(label.name),
    Boolean(label.country),
    Boolean(label.artist_count),
    Boolean(label.status),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getMissingFields(label: LabelRow): string[] {
  const missing: string[] = [];
  if (!label.name) missing.push("name");
  if (!label.country) missing.push("country");
  if (!label.artist_count) missing.push("artist_count");
  if (!label.status) missing.push("status");
  return missing;
}

function completenessTone(value: number): string {
  if (value >= 85) return "bg-emerald-100 text-emerald-700";
  if (value >= 60) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function LabelsPage() {
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
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

  const enrichedLabels = useMemo<EnrichedLabel[]>(() => labels.map(l => ({
    ...l,
    completeness: getCompleteness(l),
    missingFields: getMissingFields(l)
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
    const q = query.trim().toLowerCase();
    return enrichedLabels.filter(l => {
      const searchable = [l.name, l.country, l.status].filter(Boolean).join(" ").toLowerCase();
      if(q && !searchable.includes(q)) return false;
      if(qualityFilter === "complete") return l.completeness >= 85;
      if(qualityFilter === "incomplete") return l.completeness < 85;
      if(qualityFilter === "missing_country") return !l.country;
      if(qualityFilter === "missing_artist_count") return !l.artist_count;
      return true;
    }).sort((a,b)=>{
      if(sortMode==="name") return (a.name||"").localeCompare(b.name||"");
      if(sortMode==="artist_count_low") return (a.artist_count||0)-(b.artist_count||0);
      if(sortMode==="artist_count_high") return (b.artist_count||0)-(a.artist_count||0);
      const aTime = new Date(a.updated_at||a.created_at||0).getTime();
      const bTime = new Date(b.updated_at||b.created_at||0).getTime();
      return bTime - aTime;
    });
  }, [enrichedLabels, query, qualityFilter, sortMode]);

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      <header className="mb-4">
        <h1 className="text-3xl font-black">Label Registry</h1>
        <p className="text-sm text-[#6f7568] mt-1">View label metadata, completeness, and artist roster counts.</p>
      </header>

      <section className="mb-4 flex gap-3">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, country, or status" className="flex-1 rounded-2xl border p-3"/>
        <select value={qualityFilter} onChange={e=>setQualityFilter(e.target.value as QualityFilter)} className="rounded-2xl border p-3 text-sm">
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

      <section className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm border-collapse">
          <thead className="bg-[#fbfcf8] text-[11px] font-black uppercase tracking-wide text-[#71796b]">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Country</th>
              <th className="px-5 py-4">Artists</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Completeness</th>
              <th className="px-5 py-4">Missing</th>
            </tr>
          </thead>
          <tbody>
            {visibleLabels.map(l => (
              <tr key={l.id} className="border-b hover:bg-[#fbfcf8]">
                <td className="px-5 py-4 font-bold">{l.name||"—"}</td>
                <td className="px-5 py-4">{l.country||"—"}</td>
                <td className="px-5 py-4">{l.artist_count ?? "—"}</td>
                <td className="px-5 py-4">{l.status||"unknown"}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(l.completeness)}`}>
                    {l.completeness}%
                  </span>
                </td>
                <td className="px-5 py-4">
                  {l.missingFields.length === 0 ? <span className="text-emerald-700 font-bold">Clean</span> : <span>{l.missingFields.join(", ")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

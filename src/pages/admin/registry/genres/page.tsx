import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GenreRow = {
  id: string;
  name?: string | null;
  parent_genre?: string | null;
  track_count?: number | null;
  artist_count?: number | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type SortMode = "recent" | "name" | "track_count_low" | "track_count_high";

function getCompleteness(genre: GenreRow): number {
  const checks = [
    Boolean(genre.name),
    Boolean(genre.parent_genre),
    Boolean(genre.track_count),
    Boolean(genre.artist_count),
    Boolean(genre.status),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function GenresPage() {
  const [genres, setGenres] = useState<GenreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<"all"|"complete"|"incomplete"|"missing_parent"|"missing_tracks">("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  useEffect(() => {
    async function fetchGenres() {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from("registry_genres").select("*").limit(250);
      if (fetchError) {
        setError(fetchError.message);
        setGenres([]);
      } else {
        setGenres(data ?? []);
      }
      setLoading(false);
    }
    fetchGenres();
  }, []);

  const enrichedGenres = useMemo(() => genres.map(g => ({
    ...g,
    completeness: getCompleteness(g),
    missingFields: [
      !g.name && "name",
      !g.parent_genre && "parent_genre",
      !g.track_count && "track_count",
      !g.artist_count && "artist_count",
      !g.status && "status"
    ].filter(Boolean)
  })), [genres]);

  const summary = useMemo(() => {
    const total = enrichedGenres.length;
    const complete = enrichedGenres.filter(g => g.completeness >= 85).length;
    const missingParent = enrichedGenres.filter(g => !g.parent_genre).length;
    const missingTracks = enrichedGenres.filter(g => !g.track_count).length;
    const averageCompleteness = total ? Math.round(enrichedGenres.reduce((sum,g)=>sum+g.completeness,0)/total) : 0;
    return { total, complete, missingParent, missingTracks, averageCompleteness };
  }, [enrichedGenres]);

  const visibleGenres = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = enrichedGenres.filter(g => {
      const searchable = [g.name, g.parent_genre, g.status].filter(Boolean).join(" ").toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (qualityFilter==="complete") return g.completeness >= 85;
      if (qualityFilter==="incomplete") return g.completeness < 85;
      if (qualityFilter==="missing_parent") return !g.parent_genre;
      if (qualityFilter==="missing_tracks") return !g.track_count;
      return true;
    });

    rows = [...rows].sort((a,b)=>{
      if(sortMode==="name") return (a.name||"").localeCompare(b.name||"");
      if(sortMode==="track_count_low") return (a.track_count||0)-(b.track_count||0);
      if(sortMode==="track_count_high") return (b.track_count||0)-(a.track_count||0);
      const aTime = new Date(a.updated_at||a.created_at||0).getTime();
      const bTime = new Date(b.updated_at||b.created_at||0).getTime();
      return bTime - aTime;
    });

    return rows;
  }, [enrichedGenres, query, qualityFilter, sortMode]);

  if(loading) return <p>Loading genres...</p>;
  if(error) return <p className="text-red-700">Failed to load genres: {error}</p>;

  return (
    <div className="min-h-screen p-6 bg-[#f7f7f2]">
      <header className="mb-4">
        <h1 className="text-3xl font-black">Genre Registry</h1>
        <p className="text-sm text-[#6f7568] mt-1">Review canonical genre records, associated tracks and artists, and metadata completeness.</p>
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
          <p className="text-xs font-bold uppercase text-[#6f7568]">Missing parent</p>
          <p className="mt-2 text-3xl font-black">{summary.missingParent}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#6f7568]">Missing tracks</p>
          <p className="mt-2 text-3xl font-black">{summary.missingTracks}</p>
        </div>
      </section>

      <section className="mb-4 flex gap-3">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, parent, or status" className="flex-1 rounded-2xl border p-3"/>
        <select value={qualityFilter} onChange={e=>setQualityFilter(e.target.value as any)} className="rounded-2xl border p-3 text-sm">
          <option value="all">All quality states</option>
          <option value="complete">Near complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="missing_parent">Missing parent</option>
          <option value="missing_tracks">Missing tracks</option>
        </select>
        <select value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)} className="rounded-2xl border p-3 text-sm">
          <option value="recent">Recently updated</option>
          <option value="name">Name A-Z</option>
          <option value="track_count_low">Track count low-high</option>
          <option value="track_count_high">Track count high-low</option>
        </select>
      </section>

      <section className="overflow-x-auto rounded-3xl border bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm border-collapse">
          <thead className="bg-[#f0f2ea] text-xs uppercase text-[#6f7568]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Parent Genre</th>
              <th className="px-4 py-3">Tracks</th>
              <th className="px-4 py-3">Artists</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Completeness</th>
              <th className="px-4 py-3">Missing</th>
            </tr>
          </thead>
          <tbody>
            {visibleGenres.map(genre => (
              <tr key={genre.id} className="border-t hover:bg-[#fbfbf7]">
                <td className="px-4 py-4 font-bold">{genre.name || "—"}</td>
                <td className="px-4 py-4">{genre.parent_genre || "—"}</td>
                <td className="px-4 py-4">{genre.track_count ?? "—"}</td>
                <td className="px-4 py-4">{genre.artist_count ?? "—"}</td>
                <td className="px-4 py-4">{genre.status || "unknown"}</td>
                <td className="px-4 py-4">
                  <div className="h-2 w-full bg-[#eef1e8] rounded-full">
                    <div className="h-full rounded-full bg-[#85c441]" style={{width: `${genre.completeness}%`}} />
                  </div>
                  <span className="text-xs">{genre.completeness}%</span>
                </td>
                <td className="px-4 py-4">
                  {genre.missingFields.length === 0 ? (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">Clean</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {genre.missingFields.map(f => (
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

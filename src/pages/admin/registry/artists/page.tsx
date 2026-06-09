import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ArtistRow = {
  id: string;
  name?: string | null;
  country?: string | null;
  genres?: string | null;
  profile_image?: string | null;
  bio?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type SortMode = "recent" | "name" | "completeness_low" | "completeness_high";

function getCompleteness(artist: ArtistRow): number {
  const checks = [
    Boolean(artist.name),
    Boolean(artist.country),
    Boolean(artist.genres),
    Boolean(artist.profile_image),
    Boolean(artist.bio),
    Boolean(artist.status),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<"all" | "complete" | "incomplete" | "missing_country" | "missing_genres" | "missing_profile_image">("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  useEffect(() => {
    async function fetchArtists() {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase.from("registry_artists").select("*").limit(250);
      if (fetchError) {
        setError(fetchError.message);
        setArtists([]);
      } else {
        setArtists(data ?? []);
      }
      setLoading(false);
    }
    fetchArtists();
  }, []);

  const enrichedArtists = useMemo(() => {
    return artists.map((a) => ({
      ...a,
      completeness: getCompleteness(a),
      missingFields: [
        !a.name && "name",
        !a.country && "country",
        !a.genres && "genres",
        !a.profile_image && "profile_image",
        !a.bio && "bio",
        !a.status && "status",
      ].filter(Boolean),
    }));
  }, [artists]);

  const summary = useMemo(() => {
    const total = enrichedArtists.length;
    const complete = enrichedArtists.filter(a => a.completeness >= 85).length;
    const missingCountry = enrichedArtists.filter(a => !a.country).length;
    const missingGenres = enrichedArtists.filter(a => !a.genres).length;
    const missingProfileImage = enrichedArtists.filter(a => !a.profile_image).length;
    const averageCompleteness = total ? Math.round(enrichedArtists.reduce((sum,a)=>sum+a.completeness,0)/total) : 0;
    return { total, complete, missingCountry, missingGenres, missingProfileImage, averageCompleteness };
  }, [enrichedArtists]);

  const visibleArtists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = enrichedArtists.filter(a => {
      const searchable = [a.name,a.country,a.genres,a.status].filter(Boolean).join(" ").toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (qualityFilter==="complete") return a.completeness >= 85;
      if (qualityFilter==="incomplete") return a.completeness < 85;
      if (qualityFilter==="missing_country") return !a.country;
      if (qualityFilter==="missing_genres") return !a.genres;
      if (qualityFilter==="missing_profile_image") return !a.profile_image;
      return true;
    });

    rows = [...rows].sort((a,b)=>{
      if(sortMode==="name") return (a.name||"").localeCompare(b.name||"");
      if(sortMode==="completeness_low") return a.completeness-b.completeness;
      if(sortMode==="completeness_high") return b.completeness-a.completeness;
      const aTime = new Date(a.updated_at||a.created_at||0).getTime();
      const bTime = new Date(b.updated_at||b.created_at||0).getTime();
      return bTime-aTime;
    });
    return rows;
  }, [enrichedArtists, query, qualityFilter, sortMode]);

  if(loading) return <p>Loading artists...</p>;
  if(error) return <p className="text-red-700">Failed to load artists: {error}</p>;

  return (
    <div className="min-h-screen p-6 bg-[#f7f7f2]">
      <header className="mb-4">
        <h1 className="text-3xl font-black">Artist Registry</h1>
        <p className="text-sm text-[#6f7568] mt-1">Review canonical artist records and monitor metadata completeness.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 mb-4">
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
          <p className="text-xs font-bold uppercase text-[#6f7568]">Missing genres</p>
          <p className="mt-2 text-3xl font-black">{summary.missingGenres}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#6f7568]">Missing profile image</p>
          <p className="mt-2 text-3xl font-black">{summary.missingProfileImage}</p>
        </div>
      </section>

      <section className="mb-4 flex gap-3">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, country, genres, or status" className="flex-1 rounded-2xl border p-3"/>
        <select value={qualityFilter} onChange={e=>setQualityFilter(e.target.value as any)} className="rounded-2xl border p-3 text-sm">
          <option value="all">All quality states</option>
          <option value="complete">Near complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="missing_country">Missing country</option>
          <option value="missing_genres">Missing genres</option>
          <option value="missing_profile_image">Missing profile image</option>
        </select>
        <select value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)} className="rounded-2xl border p-3 text-sm">
          <option value="recent">Recently updated</option>
          <option value="name">Name A-Z</option>
          <option value="completeness_low">Completeness low-high</option>
          <option value="completeness_high">Completeness high-low</option>
        </select>
      </section>

      <section className="overflow-x-auto rounded-3xl border bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm border-collapse">
          <thead className="bg-[#f0f2ea] text-xs uppercase text-[#6f7568]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Genres</th>
              <th className="px-4 py-3">Profile Image</th>
              <th className="px-4 py-3">Bio</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Completeness</th>
              <th className="px-4 py-3">Missing</th>
            </tr>
          </thead>
          <tbody>
            {visibleArtists.map(artist => (
              <tr key={artist.id} className="border-t hover:bg-[#fbfbf7]">
                <td className="px-4 py-4 font-bold">{artist.name || "—"}</td>
                <td className="px-4 py-4">{artist.country || "—"}</td>
                <td className="px-4 py-4">{artist.genres || "—"}</td>
                <td className="px-4 py-4">
                  {artist.profile_image ? (
                    <img src={artist.profile_image} alt="" className="h-12 w-12 rounded-xl object-cover" loading="lazy"/>
                  ) : <span className="text-[#6f7568]">—</span>}
                </td>
                <td className="px-4 py-4 max-w-[280px] truncate">{artist.bio || "—"}</td>
                <td className="px-4 py-4">{artist.status || "unknown"}</td>
                <td className="px-4 py-4">
                  <div className="h-2 w-full bg-[#eef1e8] rounded-full">
                    <div className="h-full rounded-full bg-[#85c441]" style={{width: `${artist.completeness}%`}} />
                  </div>
                  <span className="text-xs">{artist.completeness}%</span>
                </td>
                <td className="px-4 py-4">
                  {artist.missingFields.length === 0 ? (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">Clean</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {artist.missingFields.map(f => (
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

import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { fetchAllAuthors, type AuthorRow } from "@/services/authorProfiles";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════
// WordPress username → Registry slug mapping
// ═══════════════════════════════════════════════════
const WP_USER_MAP: Record<string, string> = {
  frank: "frank-njugi",
  gatwiri_c: "gatwiri-c",
  hafare: "hafare-segelan",
  james: "muiruri-beautah",
  kiuta: "kiuta-faith",
  k_matiri: "kambura-matiri",
  mary: "mary-gathoni",
  Michael: "michael-mburu",
  swambi: "sarah-wambi",
  timo: "timothy-muiruri",
  vicmuia: "victor-muia",
  wangari: "wangari-karume",
};

interface WpUser {
  id: number;
  name: string;
  slug: string;
  description: string;
  avatar_urls?: Record<string, string>;
}

// Call the existing wp-connect-proxy edge function (no new function needed)
async function fetchWpUsers(siteUrl: string): Promise<WpUser[]> {
  const { data, error } = await supabase.functions.invoke("wp-connect-proxy", {
    body: { action: "proxy", siteUrl, path: "/wp-json/wp/v2/users?per_page=100" },
  });
  if (error) {
    throw new Error(error.message);
  }
  if (Array.isArray(data)) {
    return data as WpUser[];
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as Record<string, unknown>).error || "WP proxy failed"));
  }
  throw new Error("Unexpected response from WordPress");
}

// Strip HTML tags from WP description
function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

type SortMode = "recent" | "name" | "role";

export default function AuthorsPage() {
  const navigate = useNavigate();
  const [authors, setAuthors] = useState<AuthorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [error, setError] = useState<string | null>(null);

  const [scrapeState, setScrapeState] = useState<"idle" | "fetching" | "mapping" | "done" | "error">("idle");
  const [scrapeLog, setScrapeLog] = useState<string[]>([]);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const loadAuthors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllAuthors();
      setAuthors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load authors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAuthors(); }, [loadAuthors]);

  const handleScrape = useCallback(async () => {
    setScrapeState("fetching");
    setScrapeLog(["Connecting to wakilisha.africa..."]);
    setScrapeError(null);

    try {
      const wpUsers = await fetchWpUsers("https://wakilisha.africa");
      setScrapeLog((prev) => [...prev, `Found ${wpUsers.length} WordPress users`]);

      const mapped: { wp: WpUser; registrySlug: string }[] = [];
      const skipped: WpUser[] = [];
      for (const wp of wpUsers) {
        const registrySlug = WP_USER_MAP[wp.slug];
        if (registrySlug) {
          mapped.push({ wp, registrySlug });
        } else {
          skipped.push(wp);
        }
      }
      setScrapeLog((prev) => [...prev, `Mapped ${mapped.length} users to registry authors`]);
      if (skipped.length > 0) {
        setScrapeLog((prev) => [...prev, `Skipped ${skipped.length} unmapped WP users: ${skipped.map((u) => u.slug).join(", ")}`]);
      }

      setScrapeState("mapping");
      const updated: string[] = [];
      const failed: string[] = [];

      for (const { wp, registrySlug } of mapped) {
        const bio = stripHtml(wp.description || "").trim();
        const avatarUrl = wp.avatar_urls?.["96"] || wp.avatar_urls?.["48"] || wp.avatar_urls?.["24"] || null;

        const patch: Record<string, unknown> = {};
        if (bio) patch.bio = bio;
        if (avatarUrl) patch.avatar_url = avatarUrl;
        if (wp.name && wp.name.trim()) patch.name = wp.name.trim();

        if (Object.keys(patch).length === 0) {
          setScrapeLog((prev) => [...prev, `Skipping ${registrySlug} — no data to update`]);
          continue;
        }

        const { error: updateError } = await supabase
          .from("registry_authors")
          .update(patch)
          .eq("slug", registrySlug);

        if (updateError) {
          failed.push(registrySlug);
          setScrapeLog((prev) => [...prev, `Failed to update ${registrySlug}: ${updateError.message}`]);
        } else {
          updated.push(registrySlug);
          const updates: string[] = [];
          if (bio) updates.push("bio");
          if (avatarUrl) updates.push("avatar");
          if (wp.name) updates.push("name");
          setScrapeLog((prev) => [...prev, `Updated ${registrySlug}: ${updates.join(", ")}`]);
        }
      }

      setScrapeLog((prev) => [
        ...prev,
        `Done. ${updated.length} updated, ${failed.length} failed.`,
      ]);
      setScrapeState("done");
      // Refresh the list so user sees changes
      await loadAuthors();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scrape failed";
      setScrapeError(msg);
      setScrapeLog((prev) => [...prev, `Error: ${msg}`]);
      setScrapeState("error");
    }
  }, [loadAuthors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = authors.filter((a) => {
      if (!q) return true;
      const searchable = [a.name, a.slug, a.role, a.location, a.email].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    });

    if (sortMode === "name") rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === "role") rows = [...rows].sort((a, b) => (a.role || "").localeCompare(b.role || ""));
    return rows;
  }, [authors, query, sortMode]);

  const summary = useMemo(() => {
    const withBio = authors.filter((a) => a.bio).length;
    const withAvatar = authors.filter((a) => a.avatar_url).length;
    const withLocation = authors.filter((a) => a.location).length;
    const withSocials = authors.filter((a) => a.social_links && a.social_links.length > 0).length;
    return { total: authors.length, withBio, withAvatar, withLocation, withSocials };
  }, [authors]);

  return (
    <div className="min-h-screen bg-[var(--wk-bg)] px-5 py-6 text-[var(--wk-text)]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Authors</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--wk-text-muted)]">
              Manage canonical author profiles — bios, avatars, social links, and more.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm text-[var(--wk-text-soft)]">
              <span className="font-black text-[var(--wk-text)]">{filtered.length}</span> shown ·{" "}
              <span className="font-black text-[var(--wk-text)]">{summary.total}</span> loaded
            </div>
          </div>
        </header>

        {/* Scrape panel */}
        <section className="mb-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-[var(--wk-text)]">WordPress Author Sync</h2>
              <p className="mt-1 text-xs text-[var(--wk-text-muted)]">
                Pull bios and avatars from the old wakilisha.africa WordPress site into the registry.
                Uses the existing WP Connect Proxy — no new function needed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {scrapeState === "done" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-success-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-success)]">
                  <WkIcon name="CheckCircle2" size={12} /> Sync complete
                </span>
              )}
              <button
                onClick={handleScrape}
                disabled={scrapeState === "fetching" || scrapeState === "mapping"}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-brand)] bg-[var(--wk-brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--wk-brand-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {scrapeState === "fetching" || scrapeState === "mapping" ? (
                  <>
                    <WkIcon name="Loader2" size={13} className="animate-spin" />
                    {scrapeState === "fetching" ? "Fetching WP users..." : "Updating profiles..."}
                  </>
                ) : (
                  <>
                    <WkIcon name="Download" size={13} />
                    Scrape bios & avatars
                  </>
                )}
              </button>
            </div>
          </div>

          {scrapeLog.length > 0 && (
            <div className="mt-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3 max-h-48 overflow-auto">
              <div className="space-y-1">
                {scrapeLog.map((line, i) => (
                  <div key={i} className="text-[11px] font-mono text-[var(--wk-text-muted)] leading-4">
                    {line.startsWith("Error:") || line.startsWith("Failed") ? (
                      <span className="text-[var(--wk-danger)]">{line}</span>
                    ) : line.startsWith("Updated") ? (
                      <span className="text-[var(--wk-success)]">{line}</span>
                    ) : (
                      line
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {scrapeError && (
            <div className="mt-3 rounded-lg border border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] p-3 text-[11px] text-[var(--wk-danger)]">
              {scrapeError}
            </div>
          )}
        </section>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Total", summary.total],
            ["With bio", summary.withBio],
            ["With avatar", summary.withAvatar],
            ["With location", summary.withLocation],
            ["With socials", summary.withSocials],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[var(--wk-text-muted)]">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search authors by name, slug, role, location, or email..."
              className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 text-sm outline-none transition focus:border-[var(--wk-brand)] focus:bg-[var(--wk-surface)]"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-11 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 text-sm outline-none transition focus:border-[var(--wk-brand)] focus:bg-[var(--wk-surface)] cursor-pointer"
            >
              <option value="recent">Default order</option>
              <option value="name">Name A-Z</option>
              <option value="role">Role</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
          {loading ? (
            <div className="p-8 text-sm text-[var(--wk-text-muted)] animate-pulse">Loading authors…</div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--wk-danger)] mb-3">Failed to load authors: {error}</p>
              <button
                onClick={loadAuthors}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-sm font-bold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] transition-colors cursor-pointer"
              >
                <WkIcon name="RefreshCw" size={13} />
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-sm text-[var(--wk-text-muted)]">
              {query ? "No authors match your search." : "No authors in the registry yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[11px] font-black uppercase tracking-wide text-[var(--wk-text-muted)]">
                    <th className="w-[28%] px-5 py-4">Author</th>
                    <th className="w-[12%] px-5 py-4">Role</th>
                    <th className="w-[14%] px-5 py-4">Location</th>
                    <th className="w-[14%] px-5 py-4">Social</th>
                    <th className="w-[12%] px-5 py-4">Bio</th>
                    <th className="w-[8%] px-5 py-4">Avatar</th>
                    <th className="w-[12%] px-5 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((author) => (
                    <tr
                      key={author.id}
                      className="border-b border-[var(--wk-divider)] align-middle last:border-b-0 hover:bg-[var(--wk-bg-subtle)] cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/registry/authors/${author.slug}`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {author.avatar_url ? (
                            <img src={author.avatar_url} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[11px] font-black text-[var(--wk-brand)]">
                              {author.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-bold">{author.name}</p>
                            <p className="mt-0.5 truncate text-xs text-[var(--wk-text-faint)] font-mono">{author.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[var(--wk-text-soft)] text-[13px]">{author.role || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[var(--wk-text-soft)] text-[13px]">{author.location || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {author.social_links && author.social_links.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                            <i className={`${author.social_links[0].icon} text-[11px]`} />
                            {author.social_links.length}
                          </span>
                        ) : (
                          <span className="text-[var(--wk-text-faint)] text-[13px]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {author.bio ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-success-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--wk-success)]">
                            Filled
                          </span>
                        ) : (
                          <span className="text-[var(--wk-text-faint)] text-[13px]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {author.avatar_url ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-success-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--wk-success)]">
                            Set
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-warning-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--wk-warning)]">
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/admin/registry/authors/${author.slug}`); }}
                          className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1.5 text-xs font-bold hover:border-[var(--wk-brand)] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Edit
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
    </div>
  );
}
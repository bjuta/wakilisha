import { useEffect, useState, useCallback, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";

interface AttachmentRow {
  id: number | string;
  post_title: string;
  post_name: string;
  post_mime_type: string;
  guid: string;
  post_date: string;
  post_status: string;
  source_record_id?: string;
}

interface ListResponse {
  total: number;
  offset: number;
  limit: number;
  attachments: AttachmentRow[];
}

interface MigrationStats {
  wpTotal: number;
  alreadyMigrated: number;
  remaining: number;
  artistImagesOnOldDomain: number;
}

interface WPTableStats {
  [key: string]: number;
}

interface MigrateResult {
  wpId?: number;
  id?: string;
  oldUrl: string;
  newUrl: string | null;
  error: string | null;
  title: string;
  slug: string;
  metaKeys?: string[];
}

interface MigrateResponse {
  done: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  results: MigrateResult[];
}

export default function AdminMediaMigratePage() {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [wpStats, setWpStats] = useState<WPTableStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [mode, setMode] = useState<"staging" | "direct">("staging");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Credentials
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({
    host: "",
    port: 3306,
    user: "bn_wordpress",
    password: "",
    database: "bitnami_wordpress",
    prefix: "wp_",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsValid, setCredentialsValid] = useState(false);

  // Browse state
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const PAGE_SIZE = 50;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Migration progress
  const [migrateTotal, setMigrateTotal] = useState(0);
  const [migrateSucceeded, setMigrateSucceeded] = useState(0);
  const [migrateFailed, setMigrateFailed] = useState(0);
  const [migrateLog, setMigrateLog] = useState<MigrateResult[]>([]);
  const [migrateBatchIndex, setMigrateBatchIndex] = useState(0);
  const [migrateQueue, setMigrateQueue] = useState<(number | string)[]>([]);
  const abortRef = useRef(false);

  const BATCH_SIZE = 25;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("migrate-media-from-wp", {
        body: { action: "stats" },
      });
      if (fnError) throw new Error(fnError.message);
      setStats(data as MigrationStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const fetchWPStats = useCallback(async () => {
    if (!credentials.host || !credentials.password) {
      setError("Please enter MySQL host and password");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("migrate-media-from-wp", {
        body: {
          action: "wp_stats",
          credentials: {
            host: credentials.host,
            port: credentials.port,
            user: credentials.user,
            password: credentials.password,
            database: credentials.database,
            prefix: credentials.prefix,
          },
        },
      });
      if (fnError) throw new Error(fnError.message);
      setWpStats((data as { tables: WPTableStats }).tables);
      setCredentialsValid(true);
      setToast("Connected to WordPress database successfully!");
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setCredentialsValid(false);
      setError(err instanceof Error ? err.message : "Failed to connect to WordPress database");
    }
    setLoading(false);
  }, [credentials]);

  // Fetch the browse list
  const fetchList = useCallback(async (offset: number, searchTerm: string) => {
    setBrowseLoading(true);
    try {
      const action = mode === "direct" ? "list_attachments" : "list_staging";
      const body: Record<string, unknown> = {
        action,
        list_offset: offset,
        list_limit: PAGE_SIZE,
        search: searchTerm,
      };

      if (mode === "direct") {
        body.credentials = {
          host: credentials.host,
          port: credentials.port,
          user: credentials.user,
          password: credentials.password,
          database: credentials.database,
          prefix: credentials.prefix,
        };
      }

      const { data, error: fnError } = await supabase.functions.invoke("migrate-media-from-wp", { body });
      if (fnError) throw new Error(fnError.message);

      const result = data as ListResponse;
      setAttachments(result.attachments);
      setBrowseTotal(result.total);
      setBrowseOffset(offset);
      setSelectedIds(new Set());
      setSelectAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attachments");
    }
    setBrowseLoading(false);
  }, [mode, credentials]);

  // Initial load and mode switch
  useEffect(() => {
    if (mode === "staging") {
      fetchList(0, search);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "direct" && credentialsValid) {
      fetchList(0, search);
    }
  }, [credentialsValid, mode]);

  const handleSearch = () => {
    setSearch(searchInput);
    fetchList(0, searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  // Selection helpers
  const toggleSelect = (id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectAll(false);
  };

  const toggleSelectAllVisible = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(attachments.map((a) => a.id)));
      setSelectAll(true);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAll(false);
  };

  // Run migration for the selected items
  const handleMigrateSelected = async () => {
    if (selectedIds.size === 0) return;

    const queue = Array.from(selectedIds);
    abortRef.current = false;
    setMigrating(true);
    setMigrateQueue(queue);
    setMigrateTotal(queue.length);
    setMigrateSucceeded(0);
    setMigrateFailed(0);
    setMigrateLog([]);
    setMigrateBatchIndex(0);
    setError(null);

    // Process in batches
    let idx = 0;
    while (idx < queue.length && !abortRef.current) {
      const batch = queue.slice(idx, idx + BATCH_SIZE);
      setMigrateBatchIndex(Math.floor(idx / BATCH_SIZE) + 1);

      try {
        const action = mode === "direct" ? "migrate_selected" : "migrate_selected_staging";
        const body: Record<string, unknown> = {
          action,
          selected_ids: batch,
        };

        if (mode === "direct") {
          body.credentials = {
            host: credentials.host,
            port: credentials.port,
            user: credentials.user,
            password: credentials.password,
            database: credentials.database,
            prefix: credentials.prefix,
          };
        }

        const { data, error: fnError } = await supabase.functions.invoke("migrate-media-from-wp", { body });
        if (fnError) throw new Error(fnError.message);

        const result = data as MigrateResponse;
        setMigrateSucceeded((p) => p + result.succeeded);
        setMigrateFailed((p) => p + result.failed);
        setMigrateLog((prev) => [...result.results, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Batch failed");
        break;
      }

      idx += BATCH_SIZE;
    }

    setMigrating(false);
    if (!abortRef.current) {
      setToast(`Done! ${migrateSucceeded} succeeded, ${migrateFailed} failed.`);
      setTimeout(() => setToast(null), 5000);
      fetchStats();
      // Remove migrated items from selection
      setSelectedIds(new Set());
      setSelectAll(false);
      // Refresh the list
      fetchList(browseOffset, search);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    setMigrating(false);
    setToast("Migration paused.");
    setTimeout(() => setToast(null), 4000);
  };

  // Pagination
  const totalPages = Math.ceil(browseTotal / PAGE_SIZE);
  const currentPage = Math.floor(browseOffset / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    const offset = (page - 1) * PAGE_SIZE;
    fetchList(offset, search);
  };

  // Derived stats
  const remaining = stats ? stats.remaining : 0;
  const wpAttachmentCount = wpStats ? (wpStats[`${credentials.prefix}posts_attachments`] || 0) : 0;

  const migrateProgress = migrating && migrateTotal > 0
    ? Math.round(((migrateSucceeded + migrateFailed) / migrateTotal) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-wk-brand bg-wk-brand-soft px-4 py-3 text-[13px] font-semibold text-wk-brand shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Media</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Select & Migrate Images</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            Browse, select, and import specific images from WordPress into Supabase Storage.
          </p>
        </div>
      </div>

      {/* Mode + Credentials Row */}
      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Mode Selector */}
        <div className="rounded-xl border border-wk-border bg-wk-surface p-4 lg:w-64 lg:shrink-0">
          <span className="text-[12px] font-bold text-wk-text">Source</span>
          <div className="mt-2 flex flex-col gap-1">
            <button
              onClick={() => { setMode("staging"); setCredentialsValid(false); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                mode === "staging"
                  ? "bg-wk-brand text-white"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`}
            >
              <WkIcon name="Layers" size={14} />
              Supabase Staging
            </button>
            <button
              onClick={() => setMode("direct")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                mode === "direct"
                  ? "bg-wk-brand text-white"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`}
            >
              <WkIcon name="Database" size={14} />
              Direct MySQL
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-wk-text-faint">
            {mode === "staging"
              ? "Browse pre-staged images in registry_media_assets."
              : "Connect directly to WordPress MySQL to browse wp_posts attachments."}
          </p>
        </div>

        {/* Credentials (direct mode) */}
        {mode === "direct" && (
          <div className="flex-1 rounded-xl border border-wk-border bg-wk-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-wk-text">MySQL Connection</h3>
              <div className="flex items-center gap-2">
                {credentialsValid && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <WkIcon name="Check" size={10} /> Connected
                  </span>
                )}
                <button
                  onClick={() => setShowCredentials(!showCredentials)}
                  className="text-[12px] font-semibold text-wk-brand hover:underline"
                >
                  {showCredentials ? "Hide" : "Edit"} Credentials
                </button>
              </div>
            </div>

            {showCredentials && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-wk-text-muted">Host</label>
                  <input
                    type="text"
                    value={credentials.host}
                    onChange={(e) => setCredentials((c) => ({ ...c, host: e.target.value }))}
                    placeholder="172.26.5.134"
                    className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-2.5 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint focus:border-wk-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-wk-text-muted">Port</label>
                  <input
                    type="number"
                    value={credentials.port}
                    onChange={(e) => setCredentials((c) => ({ ...c, port: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-2.5 py-1.5 text-[12px] text-wk-text focus:border-wk-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-wk-text-muted">User</label>
                  <input
                    type="text"
                    value={credentials.user}
                    onChange={(e) => setCredentials((c) => ({ ...c, user: e.target.value }))}
                    className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-2.5 py-1.5 text-[12px] text-wk-text focus:border-wk-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-wk-text-muted">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={credentials.password}
                      onChange={(e) => setCredentials((c) => ({ ...c, password: e.target.value }))}
                      className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-2.5 py-1.5 pr-8 text-[12px] text-wk-text focus:border-wk-brand focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-wk-text-muted hover:text-wk-text"
                    >
                      <WkIcon name={showPassword ? "EyeOff" : "Eye"} size={12} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-wk-text-muted">Database</label>
                  <input
                    type="text"
                    value={credentials.database}
                    onChange={(e) => setCredentials((c) => ({ ...c, database: e.target.value }))}
                    className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-2.5 py-1.5 text-[12px] text-wk-text focus:border-wk-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-wk-text-muted">Prefix</label>
                  <input
                    type="text"
                    value={credentials.prefix}
                    onChange={(e) => setCredentials((c) => ({ ...c, prefix: e.target.value }))}
                    className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-2.5 py-1.5 text-[12px] text-wk-text focus:border-wk-brand focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={fetchWPStats}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised disabled:opacity-50 whitespace-nowrap"
              >
                <WkIcon name={loading ? "Loader2" : "PlugZap"} size={13} className={loading ? "animate-spin" : ""} />
                Test & Connect
              </button>
              {!credentialsValid && (
                <span className="text-[11px] text-wk-text-faint">Connect first to browse images</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WP Table Stats (direct mode after connect) */}
      {wpStats && mode === "direct" && (
        <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
          <h3 className="mb-2 text-[13px] font-bold text-wk-text">WordPress Tables</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(wpStats)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([table, count]) => (
                <span key={table} className="inline-flex items-center gap-1.5 rounded-full border border-wk-border bg-wk-surface-raised px-2.5 py-1">
                  <span className="text-[10px] font-medium text-wk-text-muted">{table}</span>
                  <span className="text-[12px] font-bold text-wk-text tabular-nums">{count.toLocaleString()}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Staging Stats */}
      {stats && mode === "staging" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Staged", value: stats.wpTotal.toLocaleString(), icon: "Image", color: "text-wk-brand" },
            { label: "Already Migrated", value: stats.alreadyMigrated.toLocaleString(), icon: "CheckCircle2", color: "text-emerald-600" },
            { label: "Remaining", value: remaining.toLocaleString(), icon: "Clock", color: "text-amber-600" },
            { label: "Artist Images", value: stats.artistImagesOnOldDomain.toLocaleString(), icon: "Mic2", color: "text-sky-600" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-wk-border bg-wk-surface p-3">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised ${stat.color}`}>
                  <WkIcon name={stat.icon as never} size={14} />
                </span>
                <span className="text-[11px] font-semibold text-wk-text-muted">{stat.label}</span>
              </div>
              <div className="mt-1 text-[18px] font-black text-wk-text">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="flex items-center gap-2">
            <WkIcon name="AlertTriangle" size={14} className="text-rose-600 shrink-0" />
            <p className="text-[12px] text-rose-600 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-[11px] font-semibold text-rose-700 hover:underline whitespace-nowrap">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !wpStats && (
        <div className="rounded-xl border border-wk-border bg-wk-surface p-8 text-center">
          <WkIcon name="Loader2" size={24} className="mx-auto mb-3 animate-spin text-wk-text-muted" />
          <p className="text-[13px] text-wk-text-muted">Loading...</p>
        </div>
      )}

      {/* Browse Table - only show when ready */}
      {((mode === "staging" && stats) || (mode === "direct" && credentialsValid)) && !loading && (
        <>
          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <WkIcon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-wk-text-faint" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search by title, slug or URL..."
                  className="w-64 rounded-lg border border-wk-border bg-wk-surface-raised py-1.5 pl-8 pr-3 text-[12px] text-wk-text placeholder:text-wk-text-faint focus:border-wk-brand focus:outline-none"
                />
              </div>
              <button
                onClick={handleSearch}
                className="rounded-lg border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised whitespace-nowrap"
              >
                Search
              </button>
              {search && (
                <button
                  onClick={() => { setSearchInput(""); setSearch(""); fetchList(0, ""); }}
                  className="text-[11px] text-wk-text-muted hover:text-wk-text whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Selection actions */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-wk-text-muted">
                {browseTotal.toLocaleString()} total
                {selectedIds.size > 0 && (
                  <span className="ml-1 font-bold text-wk-text">· {selectedIds.size} selected</span>
                )}
              </span>
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={clearSelection}
                    className="text-[11px] font-semibold text-wk-text-muted hover:text-wk-text whitespace-nowrap"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleMigrateSelected}
                    disabled={migrating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-wk-brand px-3 py-1.5 text-[12px] font-bold text-white hover:bg-wk-brand/90 disabled:opacity-50 whitespace-nowrap"
                  >
                    <WkIcon name="Download" size={13} />
                    Migrate {selectedIds.size} Selected
                  </button>
                </>
              )}
              {migrating && (
                <button
                  onClick={handleStop}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
                >
                  <WkIcon name="Square" size={12} />
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Migration Progress Bar */}
          {migrating && migrateTotal > 0 && (
            <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-semibold text-wk-text">
                  Migrating batch {migrateBatchIndex} of {Math.ceil(migrateTotal / BATCH_SIZE)}
                </span>
                <span className="text-[11px] font-bold text-wk-text tabular-nums">{migrateProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-wk-surface-raised">
                <div
                  className="h-full rounded-full bg-wk-brand transition-all duration-300"
                  style={{ width: `${Math.max(migrateProgress, 2)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-emerald-600">{migrateSucceeded} succeeded</span>
                <span className="text-[10px] text-rose-600">{migrateFailed} failed</span>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-wk-border bg-wk-surface overflow-hidden">
            {browseLoading ? (
              <div className="flex items-center justify-center py-12">
                <WkIcon name="Loader2" size={20} className="animate-spin text-wk-text-muted" />
              </div>
            ) : attachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <WkIcon name="Image" size={28} className="text-wk-text-faint mb-2" />
                <p className="text-[13px] text-wk-text-muted">No images found</p>
                {search && (
                  <button
                    onClick={() => { setSearchInput(""); setSearch(""); fetchList(0, ""); }}
                    className="mt-1 text-[12px] font-semibold text-wk-brand hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-wk-border bg-wk-surface-raised">
                        <th className="w-10 py-2.5 pl-4">
                          <button
                            onClick={toggleSelectAllVisible}
                            className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                              selectAll
                                ? "border-wk-brand bg-wk-brand text-white"
                                : "border-wk-border bg-white hover:border-wk-brand"
                            }`}
                          >
                            {selectAll && <WkIcon name="Check" size={10} />}
                          </button>
                        </th>
                        <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">Preview</th>
                        <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">Title / Slug</th>
                        <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-wk-text-muted hidden md:table-cell">Type</th>
                        <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-wk-text-muted hidden lg:table-cell">Date</th>
                        <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-wk-text-muted hidden xl:table-cell">URL</th>
                        <th className="w-10 py-2.5 pr-4" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wk-border">
                      {attachments.map((att) => {
                        const isSelected = selectedIds.has(att.id);
                        const filename = att.guid.split("/").pop()?.split("?")[0] || att.post_name;
                        const isImage = att.post_mime_type?.startsWith("image/");
                        const ext = filename?.split(".").pop()?.toLowerCase() || "";
                        const mimeLabel = att.post_mime_type?.replace("image/", "")?.toUpperCase() || ext.toUpperCase();

                        return (
                          <tr
                            key={String(att.id)}
                            className={`group cursor-pointer transition-colors hover:bg-wk-surface-raised ${
                              isSelected ? "bg-wk-brand-soft/30" : ""
                            }`}
                            onClick={() => toggleSelect(att.id)}
                          >
                            <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => toggleSelect(att.id)}
                                className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                                  isSelected
                                    ? "border-wk-brand bg-wk-brand text-white"
                                    : "border-wk-border bg-white hover:border-wk-brand"
                                }`}
                              >
                                {isSelected && <WkIcon name="Check" size={10} />}
                              </button>
                            </td>
                            <td className="py-2.5 pr-3">
                              {isImage ? (
                                <img
                                  src={att.guid}
                                  alt={att.post_title || filename || ""}
                                  className="h-10 w-10 rounded-md border border-wk-border object-cover bg-wk-surface-raised"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = "none";
                                    const fallback = img.nextElementSibling as HTMLElement | null;
                                    if (fallback) fallback.style.display = "flex";
                                  }}
                                />
                              ) : null}
                              {!isImage && (
                                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-wk-border bg-wk-surface-raised">
                                  <WkIcon name="File" size={16} className="text-wk-text-faint" />
                                </div>
                              )}
                              {/* Fallback when image fails to load */}
                              <div
                                className="hidden h-10 w-10 items-center justify-center rounded-md border border-wk-border bg-wk-surface-raised"
                              >
                                <WkIcon name="ImageOff" size={16} className="text-wk-text-faint" />
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 min-w-0">
                              <div className="truncate text-[12px] font-semibold text-wk-text max-w-[200px]" title={att.post_title || filename || ""}>
                                {att.post_title || filename || "Untitled"}
                              </div>
                              <div className="truncate text-[10px] text-wk-text-faint max-w-[200px]" title={att.post_name}>
                                {att.post_name || filename || ""}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 hidden md:table-cell">
                              <span className="inline-flex items-center rounded-md bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-wk-text-muted">
                                {mimeLabel}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-[11px] text-wk-text-muted hidden lg:table-cell whitespace-nowrap">
                              {att.post_date ? new Date(att.post_date).toLocaleDateString("en-US", {
                                year: "numeric", month: "short", day: "numeric",
                              }) : "—"}
                            </td>
                            <td className="py-2.5 pr-3 hidden xl:table-cell">
                              <div className="truncate text-[11px] text-wk-text-faint max-w-[280px]" title={att.guid}>
                                {att.guid}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              <a
                                href={att.guid}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-wk-text-faint hover:text-wk-brand"
                                onClick={(e) => e.stopPropagation()}
                                title="Open original"
                              >
                                <WkIcon name="ExternalLink" size={13} />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-wk-border px-4 py-2.5">
                    <span className="text-[11px] text-wk-text-muted">
                      Page {currentPage} of {totalPages} · {browseTotal.toLocaleString()} images
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised disabled:opacity-30 whitespace-nowrap"
                      >
                        First
                      </button>
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised disabled:opacity-30 whitespace-nowrap"
                      >
                        Prev
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                              pageNum === currentPage
                                ? "bg-wk-brand text-white"
                                : "text-wk-text-muted hover:bg-wk-surface-raised"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised disabled:opacity-30 whitespace-nowrap"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised disabled:opacity-30 whitespace-nowrap"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Migration Log */}
      {migrateLog.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-bold text-wk-text">Migration Log</h3>
            <button
              onClick={() => setMigrateLog([])}
              className="text-[11px] font-semibold text-wk-text-muted hover:text-wk-text whitespace-nowrap"
            >
              Clear Log
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-wk-border bg-wk-surface">
            <div className="divide-y divide-wk-border">
              {migrateLog.slice(0, 100).map((item, i) => (
                <div key={`${item.wpId || item.id}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    item.error ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                  }`}>
                    <WkIcon name={item.error ? "X" : "Check"} size={10} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-wk-text">
                      {item.title || item.oldUrl.split("/").pop()?.split("?")[0] || item.oldUrl}
                    </div>
                    <div className="truncate text-[9px] text-wk-text-faint">{item.oldUrl}</div>
                    {item.metaKeys && item.metaKeys.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {item.metaKeys.slice(0, 4).map((key) => (
                          <span key={key} className="rounded bg-wk-surface-raised px-1 py-0.5 text-[8px] text-wk-text-faint">{key}</span>
                        ))}
                        {item.metaKeys.length > 4 && (
                          <span className="text-[8px] text-wk-text-faint">+{item.metaKeys.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-[10px]">
                    {item.error ? (
                      <span className="text-rose-600" title={item.error}>
                        {item.error.length > 35 ? item.error.slice(0, 35) + "..." : item.error}
                      </span>
                    ) : (
                      <span className="text-emerald-600">OK</span>
                    )}
                  </div>
                </div>
              ))}
              {migrateLog.length > 100 && (
                <div className="px-3 py-2 text-center text-[11px] text-wk-text-faint">
                  Showing last 100 of {migrateLog.length} entries
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      {((mode === "staging" && stats) || (mode === "direct" && credentialsValid)) && !loading && (
        <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <div className="flex items-start gap-3">
            <WkIcon name="Info" size={15} className="mt-0.5 text-wk-text-muted shrink-0" />
            <div>
              <h4 className="text-[12px] font-bold text-wk-text">How to use</h4>
              <ul className="mt-1 space-y-0.5 text-[11px] text-wk-text-muted">
                <li>· Browse or search for the images you want to import</li>
                <li>· Check the box next to each image, or use the header checkbox to select all visible</li>
                <li>· Click <strong className="text-wk-text-soft">Migrate Selected</strong> to download and upload only those images</li>
                <li>· Images are uploaded to Supabase Storage under <strong className="text-wk-text-soft">cms-media/wp-migrated/</strong></li>
                <li>· Full WordPress metadata (wp_post + wp_postmeta) is preserved in registry_media_assets</li>
                {mode === "direct" && (
                  <li>· Source tables: <strong className="text-wk-text-soft">{credentials.prefix}posts</strong> + <strong className="text-wk-text-soft">{credentials.prefix}postmeta</strong></li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollLock } from "@/hooks/useScrollLock";
import type {
  CreateReleaseShellResult,
  IntakeSearchInput,
  ProviderInspectResponse,
  ProviderSearchResponse,
  ProviderSearchResult,
} from "@/services/registry/provider-intake/types";
import {
  searchProviderCatalogue,
  inspectProviderEntity,
  createReleaseShellFromProvider,
  attachProviderResultToShell,
  backfillExistingRelease,
  refreshReleaseShell,
  testProviderConnection,
} from "@/services/registry/provider-intake/client";
import { ProviderSearchResults } from "./ProviderSearchResults";
import { ProviderResultInspector } from "./ProviderResultInspector";
import { IntakeResultSummary } from "./IntakeResultSummary";

type IntakeScreen = "search" | "inspect" | "done";

interface ReleaseShellIntakeDrawerProps {
  onClose: () => void;
  onShellCreated: () => void;
  onShellCreatedWithId?: (shellId: string) => void;
}

const STOREFRONTS = [
  { code: "ke", label: "KE – Kenya" },
  { code: "ng", label: "NG – Nigeria" },
  { code: "za", label: "ZA – South Africa" },
  { code: "gh", label: "GH – Ghana" },
  { code: "tz", label: "TZ – Tanzania" },
  { code: "ug", label: "UG – Uganda" },
  { code: "us", label: "US – United States" },
  { code: "gb", label: "GB – United Kingdom" },
];

type EntityTypeFilter = "all" | "release" | "track" | "artist";

export function ReleaseShellIntakeDrawer({ onClose, onShellCreated, onShellCreatedWithId }: ReleaseShellIntakeDrawerProps) {
  // Lock background scroll while drawer is open
  useScrollLock(true);

  const [screen, setScreen] = useState<IntakeScreen>("search");

  // Search state
  const [provider] = useState<"apple_music" | "spotify">("apple_music");
  const [storefront, setStorefront] = useState("ke");
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProviderSearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Inspect state
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectedResult, setInspectedResult] = useState<ProviderInspectResponse | null>(null);
  const [inspectSourceResult, setInspectSourceResult] = useState<ProviderSearchResult | null>(null);

  // Creation state
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateReleaseShellResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Last create attempt (for refresh fallback from search results card)
  const [lastCreateAttempt, setLastCreateAttempt] = useState<ProviderSearchResult | null>(null);

  // Track selection state
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);

  // Connection test state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed" | "testing">("idle");
  const [connectionLatency, setConnectionLatency] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap: when drawer opens, focus the search input after a short delay
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard: close on Escape, trap focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Basic focus trap: keep Tab cycling within the drawer
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    setScreen("search");
    setInspectedResult(null);

    try {
      const input: IntakeSearchInput = {
        provider,
        storefront,
        entityType: entityTypeFilter,
        query: q,
        limit: 25,
      };
      const response = await searchProviderCatalogue(input);
      setSearchResults(response);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Provider search failed. Check that the registry admin server is running.");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, provider, storefront, entityTypeFilter]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleInspect = async (result: ProviderSearchResult) => {
    setInspecting(true);
    setInspectError(null);
    setInspectSourceResult(result);
    setScreen("inspect");
    setSelectedTrackIds([]);
    setCreateError(null);

    try {
      const response = await inspectProviderEntity(
        result.provider,
        result.providerEntityType,
        result.providerEntityId,
        storefront,
      );
      setInspectedResult(response);
      if (response.detail.tracks.length > 0) {
        setSelectedTrackIds(response.detail.tracks.map((t) => t.providerEntityId));
      }
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : "Failed to inspect provider result.");
      setScreen("search");
    } finally {
      setInspecting(false);
    }
  };

  const handleToggleTrack = useCallback((trackId: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId],
    );
  }, []);

  const handleSelectAllTracks = useCallback(() => {
    if (inspectedResult) {
      setSelectedTrackIds(inspectedResult.detail.tracks.map((t) => t.providerEntityId));
    }
  }, [inspectedResult]);

  const handleDeselectAllTracks = useCallback(() => {
    setSelectedTrackIds([]);
  }, []);

  // Find existing shell by provider entity ID
  const findExistingShell = async (providerEntityId: string, provider: string): Promise<string | null> => {
    try {
      const { data: links } = await supabase
        .from("provider_entity_links")
        .select("registry_entity_id")
        .eq("provider_entity_id", providerEntityId)
        .eq("provider", provider)
        .eq("registry_entity_type", "release")
        .limit(1);
      if (links && links.length > 0) {
        return links[0].registry_entity_id as string;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleCreateShell = async (result?: ProviderSearchResult) => {
    const source = result ?? inspectSourceResult;
    if (!source) return;

    if (source.providerEntityType === "artist") {
      return;
    }

    // Check if shell already exists for this provider entity
    const existingShellId = await findExistingShell(source.providerEntityId, source.provider);
    if (existingShellId) {
      // Shell already exists — open it in the review drawer
      onShellCreatedWithId?.(existingShellId);
      onClose();
      return;
    }

    setLastCreateAttempt(source);
    setCreating(true);
    setCreateError(null);
    try {
      const response = await createReleaseShellFromProvider({
        provider: source.provider,
        providerEntityType: source.providerEntityType,
        providerEntityId: source.providerEntityId,
        storefrontOrMarket: storefront,
        mode: "create_shell",
        idempotencyKey: `${source.provider}:${source.providerEntityType}:${source.providerEntityId}:${storefront}:create_shell`,
        selectedTrackIds,
      });
      setCreateResult(response);
      // Open the review drawer for the new shell
      if (response.shell?.registryEntityId) {
        onShellCreatedWithId?.(response.shell.registryEntityId);
        onClose();
      } else {
        setScreen("done");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create release shell.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleRefreshShell = async (result?: ProviderSearchResult) => {
    const source = result ?? inspectSourceResult ?? lastCreateAttempt;
    if (!source) return;

    if (source.providerEntityType === "artist") {
      return;
    }

    // If we're refreshing from the search screen (not inspect), we don't have inspectSourceResult yet.
    // We still need a source result for the success screen, so use the search result directly.
    if (!inspectSourceResult) {
      setInspectSourceResult(source);
    }

    setCreating(true);
    setCreateError(null);
    try {
      const response = await refreshReleaseShell({
        provider: source.provider,
        providerEntityType: source.providerEntityType,
        providerEntityId: source.providerEntityId,
        storefrontOrMarket: storefront,
        mode: "refresh_shell",
        idempotencyKey: `${source.provider}:${source.providerEntityType}:${source.providerEntityId}:${storefront}:refresh_shell`,
        selectedTrackIds,
      });
      setCreateResult(response);
      // Open the review drawer for the refreshed shell
      if (response.shell?.registryEntityId) {
        onShellCreatedWithId?.(response.shell.registryEntityId);
        onClose();
      } else {
        setScreen("done");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh release shell.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleAttachToShell = async (targetRegistryEntityId: string) => {
    const source = inspectSourceResult ?? searchResults?.groups.releases[0];
    if (!source) return;

    setCreating(true);
    setCreateError(null);
    try {
      const response = await attachProviderResultToShell({
        provider: source.provider,
        providerEntityType: source.providerEntityType,
        providerEntityId: source.providerEntityId,
        storefrontOrMarket: storefront,
        mode: "attach_to_shell",
        idempotencyKey: `${source.provider}:${source.providerEntityType}:${source.providerEntityId}:attach:${targetRegistryEntityId}`,
        targetRegistryEntityId,
      });
      setCreateResult(response);
      // Open the review drawer for the attached shell
      if (response.shell?.registryEntityId) {
        onShellCreatedWithId?.(response.shell.registryEntityId);
        onClose();
      } else {
        setScreen("done");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to attach provider result to shell.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleBackfillRelease = async (targetRegistryEntityId: string) => {
    const source = inspectSourceResult;
    if (!source) return;

    setCreating(true);
    setCreateError(null);
    try {
      const response = await backfillExistingRelease({
        provider: source.provider,
        providerEntityType: source.providerEntityType,
        providerEntityId: source.providerEntityId,
        storefrontOrMarket: storefront,
        mode: "backfill_existing_release",
        idempotencyKey: `${source.provider}:${source.providerEntityType}:${source.providerEntityId}:${storefront}:backfill:${targetRegistryEntityId}`,
        selectedTrackIds,
        targetRegistryEntityId,
      });
      setCreateResult(response);
      // Open the review drawer for the backfilled shell
      if (response.shell?.registryEntityId) {
        onShellCreatedWithId?.(response.shell.registryEntityId);
        onClose();
      } else {
        setScreen("done");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to backfill release.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  // Handle "Attach to existing shell" from search results card
  const handleSearchResultAttach = async (result: ProviderSearchResult) => {
    if (result.providerEntityType === "artist") return;

    // Check if shell already exists for this provider entity
    const existingShellId = await findExistingShell(result.providerEntityId, result.provider);
    if (existingShellId) {
      // Shell already exists — open it in the review drawer
      onShellCreatedWithId?.(existingShellId);
      onClose();
      return;
    }

    // No existing shell found — create one
    await handleCreateShell(result);
  };

  const handleOpenShell = () => {
    onShellCreated();
    onClose();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus("testing");
    setConnectionError(null);
    try {
      const result = await testProviderConnection(provider, storefront);
      if (result.status === "connected") {
        setConnectionStatus("connected");
        setConnectionLatency(result.latencyMs ?? null);
      } else {
        setConnectionStatus("failed");
        setConnectionError(result.error ?? "Connection test returned non-connected status.");
      }
    } catch (err) {
      setConnectionStatus("failed");
      setConnectionError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSearchAgain = () => {
    setScreen("search");
    setCreateResult(null);
    setCreateError(null);
    setInspectedResult(null);
    setInspectSourceResult(null);
    setLastCreateAttempt(null);
    setSearchResults(null);
    setSearchQuery("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isProviderAvailable = provider === "apple_music";

  // Figure out which source to show on the done screen.
  // inspectSourceResult is the rich source after inspect; lastCreateAttempt is the fallback
  // when refresh was triggered directly from search results.
  const doneScreenSource = inspectSourceResult ?? lastCreateAttempt;

  return (
    <div
      ref={drawerRef}
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Release Shell Intake"
    >
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/40 cursor-default"
        onClick={onClose}
        aria-label="Close intake drawer"
        ref={closeButtonRef}
      />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-[#f7f7f2] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfe4d8] bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f7e8]">
                <WkIcon name="Search" size={14} className="text-[#5f8f2f]" />
              </div>
              <h2 className="text-[15px] font-black text-[#171712]">Start Release Shell Intake</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-[#697062]">
              Search Apple Music and stage real provider data into the registry review queue
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#dfe4d8] text-[#71796b] hover:border-[#85c441] hover:text-[#171712] transition-colors"
          >
            <WkIcon name="X" size={15} />
          </button>
        </div>

        {/* Provider selector + Search input */}
        {screen !== "done" && (
          <div className="border-b border-[#dfe4d8] bg-white px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <WkIcon name="Search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b8bfb2]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search provider catalogue (e.g. Bien Alusa)"
                  disabled={searching}
                  className="h-10 w-full rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] pl-10 pr-4 text-[13px] text-[#171712] outline-none focus:border-[#85c441] disabled:opacity-60 placeholder:text-[#b8bfb2]"
                />
              </div>

              <select
                value={storefront}
                onChange={(e) => setStorefront(e.target.value)}
                className="h-10 rounded-2xl border border-[#dfe4d8] bg-white px-3 text-[12px] font-bold text-[#171712] outline-none focus:border-[#85c441] cursor-pointer"
              >
                {STOREFRONTS.map((sf) => (
                  <option key={sf.code} value={sf.code}>{sf.label}</option>
                ))}
              </select>

              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim() || !isProviderAvailable}
                className="flex h-10 items-center gap-2 rounded-2xl bg-[#5f8f2f] px-4 text-[13px] font-bold text-white hover:bg-[#4d7526] disabled:opacity-50 whitespace-nowrap"
              >
                {searching ? (
                  <><WkIcon name="Loader2" size={13} className="animate-spin" /> Searching…</>
                ) : (
                  <>Search</>
                )}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["all", "release", "track", "artist"] as EntityTypeFilter[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setEntityTypeFilter(type)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold capitalize transition-all ${
                    entityTypeFilter === type
                      ? "border-[#85c441] bg-[#f0f7e8] text-[#5f8f2f]"
                      : "border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#85c441]/60"
                  }`}
                >
                  {type === "all" ? "All types" : `${type}s`}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === "connected" ? "bg-emerald-500" :
                  connectionStatus === "failed" ? "bg-red-500" :
                  connectionStatus === "testing" ? "bg-amber-400 animate-pulse" :
                  "bg-[#dfe4d8]"
                }`} />
                <span className="text-[11px] font-bold text-[#5f8f2f]">
                  {connectionStatus === "connected"
                    ? `Apple Music connected${connectionLatency ? ` · ${connectionLatency}ms` : ""}`
                    : connectionStatus === "testing"
                    ? "Testing connection…"
                    : connectionStatus === "failed"
                    ? "Apple Music connection failed"
                    : "Apple Music — not tested"}
                </span>
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="ml-1 rounded-lg border border-[#dfe4d8] bg-white px-2 py-0.5 text-[9px] font-bold text-[#697062] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 whitespace-nowrap"
                >
                  {testingConnection ? "Testing…" : "Test connection"}
                </button>
              </div>
              {connectionError && (
                <span className="text-[10px] text-red-600 max-w-[240px] truncate" title={connectionError}>
                  {connectionError.slice(0, 60)}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#dfe4d8]" />
                <span className="text-[11px] text-[#b8bfb2]">Spotify not configured</span>
              </div>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Done screen */}
          {screen === "done" && createResult && doneScreenSource && (
            <IntakeResultSummary
              result={createResult}
              sourceResult={doneScreenSource}
              onOpenShell={handleOpenShell}
              onSearchAgain={handleSearchAgain}
            />
          )}

          {/* Inspect screen */}
          {screen === "inspect" && (
            <>
              {inspecting && (
                <div className="flex items-center justify-center gap-3 py-16">
                  <WkIcon name="Loader2" size={22} className="animate-spin text-[#5f8f2f]" />
                  <p className="text-[13px] font-bold text-[#171712]">Loading full provider details…</p>
                </div>
              )}
              {inspectError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <WkIcon name="AlertTriangle" size={18} className="shrink-0 text-red-700" />
                    <div>
                      <p className="text-[13px] font-bold text-red-800">Inspect failed</p>
                      <p className="mt-0.5 text-[12px] text-red-700">{inspectError}</p>
                      <button onClick={() => setScreen("search")} className="mt-2 text-[11px] font-bold text-red-700 underline">
                        Back to results
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {createError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <WkIcon name="AlertTriangle" size={18} className="shrink-0 text-red-700" />
                    <div>
                      <p className="text-[13px] font-bold text-red-800">Create failed</p>
                      <p className="mt-0.5 text-[12px] text-red-700">{createError}</p>
                    </div>
                  </div>
                </div>
              )}
              {!inspecting && !inspectError && inspectedResult && (
                <ProviderResultInspector
                  inspected={inspectedResult}
                  onCreateShell={() => handleCreateShell()}
                  onAttachToShell={handleAttachToShell}
                  onBackfillRelease={handleBackfillRelease}
                  onRefreshShell={() => handleRefreshShell()}
                  onBack={() => setScreen("search")}
                  isCreating={creating}
                  selectedTrackIds={selectedTrackIds}
                  onToggleTrack={handleToggleTrack}
                  onSelectAllTracks={handleSelectAllTracks}
                  onDeselectAllTracks={handleDeselectAllTracks}
                />
              )}
            </>
          )}

          {/* Search screen */}
          {screen === "search" && (
            <>
              {searching && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
                  <p className="text-[14px] font-bold text-[#171712]">Searching Apple Music {storefront.toUpperCase()}…</p>
                  <p className="text-[12px] text-[#697062]">&ldquo;{searchQuery}&rdquo;</p>
                </div>
              )}

              {searchError && !searching && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-start gap-3">
                    <WkIcon name="AlertTriangle" size={20} className="shrink-0 text-red-700" />
                    <div>
                      <p className="text-[13px] font-bold text-red-800">Search failed</p>
                      <p className="mt-1 text-[12px] text-red-700">{searchError}</p>
                      <button
                        onClick={handleSearch}
                        className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Retry search
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {createError && !searching && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <WkIcon name="AlertTriangle" size={18} className="shrink-0 text-red-700" />
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-red-800">Create failed</p>
                      <p className="mt-0.5 text-[12px] text-red-700">{createError}</p>
                      {createError.toLowerCase().includes("already exists") && lastCreateAttempt && (
                        <button
                          onClick={() => handleRefreshShell(lastCreateAttempt)}
                          disabled={creating}
                          className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#4a7a9e] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#3a6080] disabled:opacity-50 whitespace-nowrap"
                        >
                          {creating ? (
                            <><WkIcon name="Loader2" size={12} className="animate-spin" /> Refreshing…</>
                          ) : (
                            <><WkIcon name="RefreshCw" size={12} /> Refresh shell instead</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {searchResults && !searching && !searchError && (
                <ProviderSearchResults
                  response={searchResults}
                  onInspect={handleInspect}
                  onCreateShell={(result) => handleCreateShell(result)}
                  onAttachToShell={handleSearchResultAttach}
                  isLoading={creating}
                />
              )}

              {!searchResults && !searching && !searchError && !createError && (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                    <WkIcon name="Music2" size={28} className="text-[#97a290]" />
                  </div>
                  <div>
                    <p className="text-[16px] font-black text-[#171712]">Search provider catalogue</p>
                    <p className="mt-1 max-w-sm text-[13px] text-[#697062]">
                      Search Apple Music to find releases, tracks, and artists.
                      Results are grouped by entity type — no mixing.
                    </p>
                  </div>
                  <div className="grid w-full max-w-sm gap-2 text-left text-[12px] text-[#697062]">
                    <p className="flex items-center gap-2"><WkIcon name="Disc3" size={13} className="text-[#5f8f2f]" /> Try: <em>Bien Alusa</em></p>
                    <p className="flex items-center gap-2"><WkIcon name="Music" size={13} className="text-[#5f8f2f]" /> Try: <em>Ma Cherie</em></p>
                    <p className="flex items-center gap-2"><WkIcon name="UserCircle" size={13} className="text-[#5f8f2f]" /> Try: <em>Sauti Sol</em></p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
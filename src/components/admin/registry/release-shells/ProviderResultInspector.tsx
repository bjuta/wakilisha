import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type { ProviderInspectResponse, ProviderSearchResult, RegistryMatchCandidate, ExistingShellMatch } from "@/services/registry/provider-intake/types";

interface ProviderResultInspectorProps {
  inspected: ProviderInspectResponse;
  onCreateShell: () => void;
  onAttachToShell: (shellId: string) => void;
  onBack: () => void;
  isCreating: boolean;
  selectedTrackIds: string[];
  onToggleTrack: (trackId: string) => void;
  onSelectAllTracks: () => void;
  onDeselectAllTracks: () => void;
}

type InspectorTab = "overview" | "tracks" | "artists" | "provider_links";

function TrackRow({ track, index, isSelected, onToggle }: { track: ProviderSearchResult; index: number; isSelected: boolean; onToggle: () => void }) {
  const duration = track.summaryFields.find((f) => f.key === "duration")?.value;
  const isrc = track.summaryFields.find((f) => f.key === "isrc")?.value;
  const preview = track.summaryFields.find((f) => f.key === "preview")?.value;

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fbfcf8]">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-[#dfe4d8] accent-[#85c441] cursor-pointer"
      />
      <span className="w-6 shrink-0 text-center text-[11px] font-bold text-[#b8bfb2]">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-[#171712] truncate">{track.title}</p>
        {track.artistDisplayName && (
          <p className="text-[10px] text-[#697062] truncate">{track.artistDisplayName}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isrc && (
          <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[9px] font-mono text-[#71796b]">
            {String(isrc).slice(0, 12)}
          </span>
        )}
        {duration && (
          <span className="text-[10px] text-[#b8bfb2]">{duration}</span>
        )}
        {preview && (
          <a
            href={String(preview)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f7e8] text-[#5f8f2f] hover:bg-[#5f8f2f] hover:text-white transition-colors"
          >
            <WkIcon name="Play" size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

function MatchCandidates({ candidates }: { candidates: RegistryMatchCandidate[] }) {
  if (candidates.length === 0) return null;

  return (
    <div className="space-y-2">
      {candidates.map((c) => (
        <div key={c.registryEntityId} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <WkIcon name="AlertTriangle" size={13} className="shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-800">{c.title}</p>
              <p className="text-[10px] text-amber-700">{c.matchReason} · score {Math.round(c.matchScore * 100)}%</p>
              <p className="mt-0.5 text-[9px] font-mono text-amber-600">{c.registryEntityId}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExistingShellMatches({
  shells,
  onAttach,
}: {
  shells: ExistingShellMatch[];
  onAttach: (shellId: string) => void;
}) {
  if (shells.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <WkIcon name="AlertCircle" size={15} className="text-amber-600" />
        <p className="text-[12px] font-black text-amber-800">Possible existing WAKILISHA matches</p>
      </div>
      <div className="space-y-2">
        {shells.map((shell) => (
          <div key={shell.registryEntityId} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#171712] truncate">{shell.title}</p>
              <p className="text-[10px] text-[#697062]">
                Shell · {shell.status} · <span className="font-mono">{shell.registryEntityId.slice(0, 12)}…</span>
              </p>
            </div>
            <button
              onClick={() => onAttach(shell.registryEntityId)}
              className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 whitespace-nowrap"
            >
              Attach to existing
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProviderResultInspector({
  inspected,
  onCreateShell,
  onAttachToShell,
  onBack,
  isCreating,
  selectedTrackIds,
  onToggleTrack,
  onSelectAllTracks,
  onDeselectAllTracks,
}: ProviderResultInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const result = inspected.result;
  const isRelease = result.providerEntityType === "release";
  const isArtist = result.providerEntityType === "artist";
  const tracks = inspected.detail.tracks;
  const artists = inspected.detail.artists;
  const hasExistingShell = inspected.existingShellMatches.length > 0;

  const tabs: Array<{ id: InspectorTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "tracks", label: "Tracks", count: tracks.length },
    { id: "artists", label: "Artists", count: artists.length },
    { id: "provider_links", label: "Provider links", count: inspected.detail.providerLinks.length },
  ];

  const allRegistryMatches = [
    ...inspected.possibleRegistryMatches.releases,
    ...inspected.possibleRegistryMatches.artists,
    ...inspected.possibleRegistryMatches.tracks,
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Back nav */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[12px] font-bold text-[#697062] hover:text-[#171712] w-fit"
      >
        <WkIcon name="ChevronLeft" size={14} />
        Back to results
      </button>

      {/* Result header */}
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <div className="flex items-start gap-4">
          {result.artworkUrl ? (
            <img
              src={result.artworkUrl}
              alt={result.title}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover object-top"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#f0f3ec]">
              <WkIcon name="Disc3" size={28} className="text-[#97a290]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[18px] font-black text-[#171712]">{result.title}</p>
              <span className="rounded-full bg-[#f0f7e8] border border-[#c8e6a0] px-2 py-0.5 text-[10px] font-bold text-[#5f8f2f] uppercase">
                {result.providerEntityType}
              </span>
            </div>
            {result.artistDisplayName && (
              <p className="mt-0.5 text-[13px] text-[#697062]">{result.artistDisplayName}</p>
            )}
            <p className="mt-1 text-[11px] text-[#b8bfb2]">
              {result.source.storefrontOrMarket?.toUpperCase()} · Apple Music ·
              ID: <span className="font-mono">{result.providerEntityId}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Existing shell match warning */}
      {hasExistingShell && (
        <ExistingShellMatches
          shells={inspected.existingShellMatches}
          onAttach={onAttachToShell}
        />
      )}

      {/* Registry match candidates */}
      {allRegistryMatches.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[12px] font-black text-amber-800 mb-2">Possible WAKILISHA registry matches</p>
          <MatchCandidates candidates={allRegistryMatches} />
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-2xl border border-[#dfe4d8] bg-[#f7f7f2] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-[#171712] shadow-sm"
                : "text-[#71796b] hover:text-[#171712]"
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? "bg-[#f0f7e8] text-[#5f8f2f]" : "bg-[#dfe4d8] text-[#71796b]"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-[#dfe4d8] bg-white">
        {activeTab === "overview" && (
          <div className="p-5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#71796b]">Provider fields</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {result.summaryFields.filter((f) => f.value !== null && f.value !== "").map((field) => (
                <div key={field.key} className="rounded-xl bg-[#fbfcf8] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">{field.label}</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-[#171712] break-words">{String(field.value)}</p>
                </div>
              ))}
              {result.artworkUrl && (
                <div className="rounded-xl bg-[#fbfcf8] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Artwork URL</p>
                  <a
                    href={result.artworkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-[11px] text-[#5f8f2f] hover:underline truncate"
                  >
                    {result.artworkUrl.slice(0, 60)}…
                  </a>
                </div>
              )}
              {result.providerUrl && (
                <div className="rounded-xl bg-[#fbfcf8] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Provider URL</p>
                  <a
                    href={result.providerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-[11px] text-[#5f8f2f] hover:underline truncate"
                  >
                    Open in Apple Music
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "tracks" && (
          <div className="p-5">
            {tracks.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-[#697062]">No tracks returned for this result.</p>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    {tracks.length} track{tracks.length !== 1 ? "s" : ""} · {selectedTrackIds.length} selected
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={onSelectAllTracks}
                      className="rounded-lg border border-[#dfe4d8] bg-white px-2.5 py-1 text-[10px] font-bold text-[#5f8f2f] hover:border-[#85c441] whitespace-nowrap"
                    >
                      Select all
                    </button>
                    <button
                      onClick={onDeselectAllTracks}
                      className="rounded-lg border border-[#dfe4d8] bg-white px-2.5 py-1 text-[10px] font-bold text-[#697062] hover:border-[#85c441] whitespace-nowrap"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {tracks.map((track, index) => (
                    <TrackRow
                      key={track.providerEntityId || index}
                      track={track}
                      index={index}
                      isSelected={selectedTrackIds.includes(track.providerEntityId)}
                      onToggle={() => onToggleTrack(track.providerEntityId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "artists" && (
          <div className="p-5">
            {artists.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-[#697062]">No artist data returned for this result.</p>
            ) : (
              <div className="space-y-2">
                {artists.map((artist) => (
                  <div key={artist.providerEntityId} className="flex items-center gap-3 rounded-xl bg-[#fbfcf8] p-3">
                    {artist.artworkUrl ? (
                      <img src={artist.artworkUrl} alt={artist.title} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f3ec]">
                        <WkIcon name="UserCircle" size={18} className="text-[#97a290]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#171712]">{artist.title}</p>
                      <p className="text-[10px] font-mono text-[#b8bfb2]">{artist.providerEntityId}</p>
                    </div>
                    {artist.providerUrl && (
                      <a href={artist.providerUrl} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 text-[#5f8f2f] hover:underline text-[10px]">
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "provider_links" && (
          <div className="p-5">
            {inspected.detail.providerLinks.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-[#697062]">No provider links returned.</p>
            ) : (
              <div className="space-y-2">
                {inspected.detail.providerLinks.map((link, index) => (
                  <div key={`${link.entityType}-${link.providerEntityId}-${index}`} className="rounded-xl bg-[#fbfcf8] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#f0f7e8] px-2 py-0.5 text-[9px] font-bold uppercase text-[#5f8f2f]">
                        {link.entityType}
                      </span>
                      <span className="font-mono text-[10px] text-[#71796b]">{link.providerEntityId}</span>
                    </div>
                    {link.providerUrl && (
                      <a href={link.providerUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[10px] text-[#5f8f2f] hover:underline truncate">
                        {link.providerUrl.slice(0, 60)}…
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#71796b]">Actions</p>

        {isArtist ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[12px] font-bold text-amber-800">
              Artist results cannot directly create release shells.
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700">
              You can stage artist identity or search this artist&apos;s releases separately.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!hasExistingShell && (
              <button
                onClick={onCreateShell}
                disabled={isCreating}
                className="flex items-center gap-2 rounded-xl bg-[#5f8f2f] px-4 py-2.5 text-[12px] font-bold text-white hover:bg-[#4d7526] disabled:opacity-50 whitespace-nowrap"
              >
                {isCreating ? (
                  <><WkIcon name="Loader2" size={14} className="animate-spin" /> Creating shell…</>
                ) : (
                  <><WkIcon name="Plus" size={14} /> Create release shell</>
                )}
              </button>
            )}

            {hasExistingShell && (
              <div className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[12px] text-[#697062]">
                <WkIcon name="Info" size={13} className="inline mr-1.5 text-amber-600" />
                This provider {isRelease ? "release" : "track"} is already staged. Attach to the existing shell above instead.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
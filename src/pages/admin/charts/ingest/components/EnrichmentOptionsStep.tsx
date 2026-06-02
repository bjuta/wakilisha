import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestEnrichmentOptions, PreviewProvider } from "@/services/chartsEnrichment/enrichmentOptions";
import { summarizeEnrichmentOptions } from "@/services/chartsEnrichment/enrichmentOptions";

const providers: PreviewProvider[] = ["apple_music", "spotify", "youtube", "acrcloud"];

function label(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

type EnrichmentOptionsStepProps = {
  options: IngestEnrichmentOptions;
  onChange: (options: IngestEnrichmentOptions) => void;
};

function Toggle({ checked, onChange, labelText, help }: { checked: boolean; onChange: (checked: boolean) => void; labelText: string; help?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-3 hover:bg-wk-surface-raised transition-colors">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-wk-border accent-wk-brand" />
      <span>
        <span className="block text-[12px] font-semibold text-wk-text-soft">{labelText}</span>
        {help && <span className="mt-0.5 block text-[11px] text-wk-text-muted">{help}</span>}
      </span>
    </label>
  );
}

export function EnrichmentOptionsStep({ options, onChange }: EnrichmentOptionsStepProps) {
  function patch(next: Partial<IngestEnrichmentOptions>) {
    onChange({ ...options, ...next });
  }

  function moveProvider(provider: PreviewProvider, direction: -1 | 1) {
    const current = [...options.previewProviderPriority];
    const index = current.indexOf(provider);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
    patch({ previewProviderPriority: current });
  }

  return (
    <WkSurface className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-wk-text">Enrichment Options</h3>
          <p className="mt-1 text-[12px] text-wk-text-soft">
            Choose which extra metadata the dry run should attempt to collect. Preview data is a UX enhancement by default, not an eligibility requirement unless explicitly enabled.
          </p>
        </div>
        <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand">Metadata</span>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <Toggle checked={options.ingestWithPreviewData} onChange={(checked) => patch({ ingestWithPreviewData: checked })} labelText="Ingest with preview data" help="Capture preview URLs and provider preview metadata where available." />
        <Toggle checked={options.requirePreview} onChange={(checked) => patch({ requirePreview: checked })} labelText="Require preview" help="Only use this for charts where preview availability is part of eligibility." />
        <Toggle checked={options.allowYouTubeFallback} onChange={(checked) => patch({ allowYouTubeFallback: checked })} labelText="Allow YouTube fallback" help="Use YouTube embed/search as a fallback when provider preview is missing." />
        <Toggle checked={options.allowAcrCloudRecovery} onChange={(checked) => patch({ allowAcrCloudRecovery: checked })} labelText="Allow ACRCloud recovery" help="Attempt metadata/preview recovery when provider metadata is incomplete." />
      </div>

      {options.ingestWithPreviewData && (
        <div className="mb-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-wk-text">
            <WkIcon name="ListOrdered" size={14} className="text-wk-brand" />
            Preview provider priority
          </div>
          <div className="space-y-2">
            {options.previewProviderPriority.map((provider, index) => (
              <div key={provider} className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px]">
                <span className="font-semibold text-wk-text-soft">{index + 1}. {label(provider)}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => moveProvider(provider, -1)} className="rounded border border-wk-border px-2 py-0.5 text-[10px] text-wk-text-muted disabled:opacity-40" disabled={index === 0}>Up</button>
                  <button type="button" onClick={() => moveProvider(provider, 1)} className="rounded border border-wk-border px-2 py-0.5 text-[10px] text-wk-text-muted disabled:opacity-40" disabled={index === providers.length - 1}>Down</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <Toggle checked={options.enrichArtists} onChange={(checked) => patch({ enrichArtists: checked })} labelText="Enrich artists" help="Resolve provider artist IDs, aliases, images, URLs, and profile data." />
        <Toggle checked={options.enrichLabels} onChange={(checked) => patch({ enrichLabels: checked })} labelText="Enrich labels" help="Capture label names and provider label metadata where available." />
        <Toggle checked={options.enrichReleaseMetadata} onChange={(checked) => patch({ enrichReleaseMetadata: checked })} labelText="Enrich releases" help="Capture release date, album/single type, artwork, UPC, and related metadata." />
        <Toggle checked={options.enrichMarketAvailability} onChange={(checked) => patch({ enrichMarketAvailability: checked })} labelText="Market availability" help="Capture provider availability/restriction signals per market." />
        <Toggle checked={options.preserveRawProviderPayloads} onChange={(checked) => patch({ preserveRawProviderPayloads: checked })} labelText="Preserve raw provider payloads" help="Keep raw provider data for audit and future reprocessing." />
      </div>

      <div className="rounded-lg bg-wk-bg p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
          <WkIcon name="ClipboardCheck" size={12} /> Selected enrichment policy
        </div>
        <div className="grid gap-1 text-[11px] text-wk-text-soft sm:grid-cols-2">
          {summarizeEnrichmentOptions(options).map((item) => <span key={item}>• {item}</span>)}
        </div>
      </div>
    </WkSurface>
  );
}

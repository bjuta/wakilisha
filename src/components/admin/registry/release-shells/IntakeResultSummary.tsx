import type { CreateReleaseShellResult, ProviderSearchResult } from "@/services/registry/provider-intake/types";
import { WkIcon } from "@/components/design-system/Icon";

interface IntakeResultSummaryProps {
  result: CreateReleaseShellResult;
  sourceResult: ProviderSearchResult;
  onOpenShell: () => void;
  onSearchAgain: () => void;
}

export function IntakeResultSummary({
  result,
  sourceResult,
  onOpenShell,
  onSearchAgain,
}: IntakeResultSummaryProps) {
  const { writes, skipped, shell } = result;
  const totalSkipped = skipped.length;
  const isNewShell = writes.lifecycleEvents > 0;

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f7e8]">
        <WkIcon name="CheckCircle" size={28} className="text-[#5f8f2f]" />
      </div>

      <div>
        <h2 className="text-[18px] font-black text-[#171712]">
          {isNewShell ? "Release shell created" : "Provider data attached"}
        </h2>
        <p className="mt-1 text-[13px] text-[#697062]">
          {isNewShell
            ? `Release shell created from Apple Music ${sourceResult.providerEntityType}.`
            : `Provider data attached to existing shell.`}
        </p>
      </div>

      {/* Write summary */}
      <div className="w-full max-w-md rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#71796b]">Staging writes</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white border border-[#dfe4d8] p-3 text-center">
            <p className="text-[22px] font-black text-[#5f8f2f]">{writes.providerFieldObservations}</p>
            <p className="text-[10px] font-bold text-[#71796b]">Field observations</p>
          </div>
          <div className="rounded-xl bg-white border border-[#dfe4d8] p-3 text-center">
            <p className="text-[22px] font-black text-[#5f8f2f]">{writes.registryEnrichmentSuggestions}</p>
            <p className="text-[10px] font-bold text-[#71796b]">Enrichment suggestions</p>
          </div>
          <div className="rounded-xl bg-white border border-[#dfe4d8] p-3 text-center">
            <p className="text-[22px] font-black text-[#5f8f2f]">{writes.providerEntityLinks}</p>
            <p className="text-[10px] font-bold text-[#71796b]">Provider links</p>
          </div>
          <div className="rounded-xl bg-white border border-[#dfe4d8] p-3 text-center">
            <p className="text-[22px] font-black text-[#71796b]">{totalSkipped}</p>
            <p className="text-[10px] font-bold text-[#71796b]">Skipped (already exist)</p>
          </div>
        </div>
      </div>

      {/* Shell key */}
      <div className="w-full max-w-md rounded-xl bg-[#f0f3ec] px-4 py-2.5 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#71796b]">Shell ID</p>
        <p className="mt-0.5 font-mono text-[11px] text-[#171712]">{shell.registryEntityId}</p>
      </div>

      {/* Important disclaimer */}
      <p className="max-w-sm text-[11px] text-[#697062]">
        No canonical registry data was written. All data is staged for human review.
        Use the Release Shell review workflow to approve and apply fields.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={onOpenShell}
          className="rounded-xl bg-[#5f8f2f] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#4d7526] whitespace-nowrap"
        >
          <span className="flex items-center gap-2">
            <WkIcon name="ArrowRight" size={14} />
            Open review queue
          </span>
        </button>
        <button
          onClick={onSearchAgain}
          className="rounded-xl border border-[#dfe4d8] bg-white px-5 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441] whitespace-nowrap"
        >
          Search again
        </button>
      </div>
    </div>
  );
}
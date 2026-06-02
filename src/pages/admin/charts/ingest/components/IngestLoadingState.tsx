export function IngestLoadingState() {
  return (
    <div className="flex h-96 flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-wk-brand/30 border-t-wk-brand" />
      <p className="text-[13px] font-medium text-wk-text-muted">Loading Ingest Studio…</p>
    </div>
  );
}

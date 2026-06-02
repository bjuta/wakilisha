interface AdminChartsLoadingStateProps {
  message?: string;
}

export function AdminChartsLoadingState({ message = "Loading..." }: AdminChartsLoadingStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-wk-border-2 border-t-wk-brand" />
      <p className="text-[13px] font-medium text-wk-text-muted">{message}</p>
    </div>
  );
}
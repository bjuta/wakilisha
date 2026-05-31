import { useState } from "react";
import { clearChartCache } from "@/services/chartsPublic/cache";
import { WkIcon } from "@/components/design-system/Icon";

interface ChartRefreshButtonProps {
  onRefresh: () => void;
  size?: "sm" | "md";
}

export function ChartRefreshButton({ onRefresh, size = "md" }: ChartRefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    clearChartCache();
    await onRefresh();
    setRefreshing(false);
  };

  const sizeClasses = size === "sm"
    ? "text-[11px] px-2 py-1 gap-1"
    : "text-[12px] px-3 py-1.5 gap-1.5";

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      className={`inline-flex items-center rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] disabled:opacity-50 whitespace-nowrap ${sizeClasses}`}
      title="Clear cache and refresh chart data"
    >
      <WkIcon name="RefreshCw" size={size === "sm" ? 12 : 14} className={refreshing ? "animate-spin" : ""} />
      {refreshing ? "Refreshing..." : "Refresh data"}
    </button>
  );
}
interface AdminChartsLoadingStateProps {
  message?: string;
}

import { SkeletonBlock } from "@/components/skeletons/Skeletons";

export function AdminChartsLoadingState({ message = "Loading..." }: AdminChartsLoadingStateProps) {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3 mb-6">
        <SkeletonBlock className="h-8 w-8 rounded-lg" />
        <SkeletonBlock className="h-5 w-48 rounded" />
      </div>
      <SkeletonBlock className="h-[300px] rounded-xl border border-[var(--wk-border)]" />
    </div>
  );
}
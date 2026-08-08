import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface BadgeCounts {
  missingImages: number;
  brokenLinks: number;
  reviewQueue: number;
  failedImports: number;
  pendingReports: number;
  registryTrackIntake: number;
  loading: boolean;
}

const emptyCounts: BadgeCounts = {
  missingImages: 0,
  brokenLinks: 0,
  reviewQueue: 0,
  failedImports: 0,
  pendingReports: 0,
  registryTrackIntake: 0,
  loading: false,
};

export function useAdminBadgeCounts(): BadgeCounts {
  const [counts, setCounts] = useState<BadgeCounts>({
    ...emptyCounts,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadRegistryTrackIntakeCount() {
      const { count, error } = await supabase
        .from("registry_provider_track_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "needs_review");

      if (cancelled) return;

      setCounts({
        ...emptyCounts,
        registryTrackIntake: error ? 0 : Number(count ?? 0),
        loading: false,
      });
    }

    void loadRegistryTrackIntakeCount();

    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

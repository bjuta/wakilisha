interface BadgeCounts {
  missingImages: number;
  brokenLinks: number;
  reviewQueue: number;
  failedImports: number;
  pendingReports: number;
  loading: boolean;
}

const emptyCounts: BadgeCounts = {
  missingImages: 0,
  brokenLinks: 0,
  reviewQueue: 0,
  failedImports: 0,
  pendingReports: 0,
  loading: false,
};

export function useAdminBadgeCounts(): BadgeCounts {
  return emptyCounts;
}

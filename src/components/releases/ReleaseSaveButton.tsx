import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  useEntityActions,
} from "@/hooks/useCommunityActions";
import {
  getUserSaves,
} from "@/services/community";
import {
  slugify,
  type PublicReleaseDetail,
} from "@/services/publicContent/client";

function matchesRelease(
  row: unknown,
  release: PublicReleaseDetail,
): boolean {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const record = row as Record<string, unknown>;
  return record.entity_type === "release" && (
    record.entity_id === release.id ||
    record.entity_slug === release.slug
  );
}

export function ReleaseSaveButton({
  release,
  compact = false,
}: {
  release: PublicReleaseDetail;
  compact?: boolean;
}) {
  const authUser = useAuthUser();
  const { setSaved } = useEntityActions(
    !authUser.loading ? authUser.id || undefined : undefined,
  );
  const [saved, setSavedLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    if (authUser.loading || !authUser.id) {
      setSavedLocal(false);
      return;
    }
    try {
      const rows = await getUserSaves(authUser.id);
      setSavedLocal(rows.some((row) => matchesRelease(row, release)));
    } catch {
      setSavedLocal(false);
    }
  }, [authUser.id, authUser.loading, release]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleToggle = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await setSaved({
        entityType: "release",
        entityId: release.id,
        entitySlug: release.slug,
        entityUrl: `/releases/${slugify(release.artist)}/${release.slug}`,
        title: release.title,
        subtitle: release.artist,
        imageUrl: release.artworkUrl || undefined,
      }, !saved);
      if (!result) return;
      setSavedLocal(result.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update Save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => { void handleToggle(); }}
        disabled={saving}
        className={compact
          ? [
              "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-60",
              saved
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]",
            ].join(" ")
          : [
              "inline-flex items-center gap-2.5 rounded-xl border px-5 py-3 text-[13px] font-bold transition-colors whitespace-nowrap disabled:opacity-60",
              saved
                ? "border-[var(--wk-brand)]/25 bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]",
            ].join(" ")}
        aria-label={saved ? "Remove saved Release" : "Save Release"}
        title={saved ? "Saved" : "Save"}
      >
        <WkIcon
          name={saving ? "Loader2" : "Heart"}
          size={compact ? 17 : 16}
          fill={saved ? "currentColor" : "none"}
          className={saving ? "animate-spin" : undefined}
        />
        {compact ? (
          <span className="sr-only">{saved ? "Saved" : "Save"}</span>
        ) : (
          <span>{saved ? "Saved" : "Save"}</span>
        )}
      </button>
      {error ? (
        <div
          role="status"
          className="absolute left-1/2 top-[calc(100%+8px)] z-[70] w-56 -translate-x-1/2 rounded-xl border border-red-200 bg-white px-3 py-2 text-[10px] font-bold leading-relaxed text-red-700 shadow-lg"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Portal } from "@/components/base/Portal";
import { WkIcon } from "@/components/design-system/Icon";
import {
  deletePostDraft,
  listPostDrafts,
  type CommunityPostDraft,
} from "@/services/community/postDrafts";
import type { PostActor } from "@/services/community/posts";

function draftPreview(draft: CommunityPostDraft): string {
  const body = draft.body.trim();
  if (body) return body;
  if (draft.track) {
    return `${draft.track.title}${draft.track.artistName ? ` · ${draft.track.artistName}` : ""}`;
  }
  if (draft.linkLabel) return draft.linkLabel;
  if (draft.linkUrl) return draft.linkUrl;
  if (draft.imageUrl) return "Photo";
  if (draft.quotedPostId) return "Quote Post";
  return "Empty draft";
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function PostDraftsDialog({
  actor,
  onSelect,
  onClose,
}: {
  actor: PostActor;
  onSelect: (drafts: CommunityPostDraft[]) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<CommunityPostDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listPostDrafts(actor)
      .then((items) => {
        if (!cancelled) setDrafts(items);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "We could not load your Drafts.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actor.id, actor.type]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, CommunityPostDraft[]>();

    for (const draft of drafts) {
      const group = byGroup.get(draft.draftGroupId) ?? [];
      group.push(draft);
      byGroup.set(draft.draftGroupId, group);
    }

    return Array.from(byGroup.values())
      .map((group) => group.sort((left, right) => left.position - right.position))
      .sort((left, right) => {
        const leftUpdated = Math.max(...left.map((draft) => Date.parse(draft.updatedAt) || 0));
        const rightUpdated = Math.max(...right.map((draft) => Date.parse(draft.updatedAt) || 0));
        return rightUpdated - leftUpdated;
      });
  }, [drafts]);

  async function removeGroup(group: CommunityPostDraft[]) {
    const groupId = group[0]?.draftGroupId;
    if (!groupId || deletingGroupId) return;

    setDeletingGroupId(groupId);
    setError(null);
    try {
      for (const draft of group) {
        await deletePostDraft(draft.id);
      }
      setDrafts((current) =>
        current.filter((draft) => draft.draftGroupId !== groupId),
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not delete this Draft.",
      );
    } finally {
      setDeletingGroupId(null);
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[190] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Post Drafts"
      >
        <button
          type="button"
          aria-label="Close Drafts"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
        />

        <div className="relative z-[1] flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[var(--wk-surface)] shadow-2xl sm:max-w-[620px] sm:rounded-[28px]">
          <div className="flex items-center justify-between border-b border-[var(--wk-divider)] px-5 py-4">
            <div>
              <h2 className="text-[17px] font-black text-[var(--wk-text)]">Drafts</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                Saved privately as {actor.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Drafts"
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--wk-bg)]"
            >
              <WkIcon name="X" size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {loading ? (
              <div className="py-10 text-center text-[12px] font-semibold text-[var(--wk-text-muted)]">
                Loading Drafts...
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--wk-border)] px-5 py-10 text-center">
                <div className="text-[14px] font-black text-[var(--wk-text)]">No Drafts yet</div>
                <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                  Save a Post before publishing and it will stay here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => {
                  const first = group[0];
                  const last = group[group.length - 1];
                  if (!first || !last) return null;

                  const isThread = group.length > 1;
                  const deleting = deletingGroupId === first.draftGroupId;

                  return (
                    <div
                      key={first.draftGroupId}
                      className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onSelect(group)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-brand)]">
                            <span>{isThread ? "Thread draft" : "Post draft"}</span>
                            {isThread ? <span>· {group.length} Posts</span> : null}
                          </div>
                          <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-[1.45] text-[var(--wk-text)]">
                            {draftPreview(first)}
                          </p>
                          <div className="mt-2 text-[10px] font-semibold text-[var(--wk-text-faint)]">
                            Updated {formatUpdated(last.updatedAt)}
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => void removeGroup(group)}
                          className="rounded-full px-3 py-2 text-[10px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface)] hover:text-red-600 disabled:opacity-50"
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Portal>
  );
}

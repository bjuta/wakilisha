import { useState, useRef, useCallback, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { trackEvent } from "@/services/analytics";
import type { CommunityEntity, ReportReason } from "@/services/community";
import { followTarget, saveEntity, reportComment } from "@/services/community";
import { ShareSheet } from "@/components/design-system/share/ShareSheet";
import { ContributionSheet } from "@/components/feature/community/ContributionSheet";
import { buildCommunityAuthUrl, stashPendingCommunityAction } from "@/services/community/authIntent";
import { buildVerifyEmailUrl } from "@/services/auth/accountVerification";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Portal } from "@/components/base/Portal";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CommunityActionState {
  saved: boolean;
  following: boolean;
}

interface CommunityActionSheetProps {
  entity: CommunityEntity;
  open: boolean;
  onClose: () => void;
  userId?: string;
  actionState?: CommunityActionState;
  onComment?: () => void;
}

const REPORT_REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: "spam", label: "Spam", icon: "ri-spam-line" },
  { value: "harassment", label: "Harassment", icon: "ri-alert-line" },
  { value: "hate_or_abuse", label: "Hate or Abuse", icon: "ri-forbid-line" },
  { value: "misinformation", label: "Misinformation", icon: "ri-error-warning-line" },
  { value: "privacy", label: "Privacy Violation", icon: "ri-shield-keyhole-line" },
  { value: "copyright", label: "Copyright Issue", icon: "ri-copyright-line" },
  { value: "off_topic", label: "Off Topic", icon: "ri-chat-off-line" },
  { value: "other", label: "Other", icon: "ri-more-line" },
];

// ── Action row helper ──────────────────────────────────────────────────────

function ActionRow({
  icon,
  label,
  onClick,
  active = false,
  activeIcon,
  pending = false,
  danger = false,
  compact = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeIcon?: string;
  pending?: boolean;
  danger?: boolean;
  compact?: boolean;
}) {
  const displayIcon = active && activeIcon ? activeIcon : icon;
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`flex items-center gap-3 w-full px-5 ${compact ? "py-2.5" : "py-3"} text-left transition-colors active:bg-[var(--wk-surface)] disabled:opacity-50 cursor-pointer whitespace-nowrap`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[17px] shrink-0 transition-colors ${
        active
          ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
          : danger
            ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
            : "bg-[var(--wk-surface)] text-[var(--wk-text-muted)]"
      }`}>
        {pending ? (
          <i className="ri-loader-4-line animate-spin" />
        ) : (
          <i className={displayIcon} />
        )}
      </div>
      <span className={`text-[14px] font-semibold flex-1 ${danger ? "text-[var(--wk-danger)]" : "text-[var(--wk-text)]"}`}>
        {label}
      </span>
      {active && (
        <span className="w-2 h-2 rounded-full bg-[var(--wk-brand)] shrink-0" />
      )}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function CommunityActionSheet({
  entity,
  open,
  onClose,
  userId,
  actionState = { saved: false, following: false },
  onComment,
}: CommunityActionSheetProps) {
  const authUser = useAuthUser();
  const [saved, setSaved] = useState(actionState.saved);
  const [following, setFollowing] = useState(actionState.following);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const isDragging = useRef(false);

  useScrollLock(open);

  // Sync external actionState changes
  useEffect(() => {
    setSaved(actionState.saved);
    setFollowing(actionState.following);
  }, [actionState.saved, actionState.following]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drag-to-dismiss
  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = dragStartY.current;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    dragCurrentY.current = e.touches[0].clientY;
    const delta = dragCurrentY.current - dragStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      sheetRef.current.style.transition = "none";
    }
  };
  const onTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = dragCurrentY.current - dragStartY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)";
      if (delta > 80) {
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(() => onClose(), 250);
      } else {
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────

  const redirectToAuthForAction = useCallback((action: "save" | "follow") => {
    stashPendingCommunityAction({ action, entity });
    trackEvent("community_auth_required", {
      pageType: "community",
      entitySlug: entity.slug,
      entityType: entity.type,
      context: { action, entity_title: entity.title },
    });
    onClose();
    window.location.assign(buildCommunityAuthUrl());
  }, [entity, onClose]);

  const redirectToVerificationForAction = useCallback((action?: "save" | "follow" | "comment" | "report") => {
    if (action === "save" || action === "follow") {
      stashPendingCommunityAction({ action, entity });
    }

    trackEvent("community_email_verification_required", {
      pageType: "community",
      entitySlug: entity.slug,
      entityType: entity.type,
      context: { action, entity_title: entity.title },
    });

    onClose();
    window.location.assign(buildVerifyEmailUrl(undefined, authUser.email));
  }, [authUser.email, entity, onClose]);

  const requireVerifiedForAction = useCallback((action?: "save" | "follow" | "comment" | "report") => {
    if (!userId) return false;
    if (authUser.loading) return false;

    if (!authUser.isEmailVerified) {
      redirectToVerificationForAction(action);
      return false;
    }

    return true;
  }, [userId, authUser.loading, authUser.isEmailVerified, redirectToVerificationForAction]);

  const handleSave = useCallback(async () => {
    if (!userId) {
      redirectToAuthForAction("save");
      return;
    }
    if (!requireVerifiedForAction("save")) return;
    if (savePending) return;
    setSavePending(true);
    try {
      const result = await saveEntity({
        entityType: entity.type,
        entityId: entity.id,
        entitySlug: entity.slug,
        entityUrl: entity.url,
        title: entity.title,
        subtitle: entity.subtitle,
        imageUrl: entity.imageUrl,
      });
      const nowSaved = result?.saved ?? !saved;
      setSaved(nowSaved);
      trackEvent("community_save", {
        pageType: "article",
        entitySlug: entity.slug,
        entityType: entity.type,
        context: { action: nowSaved ? "save" : "unsave", entity_title: entity.title },
      });
    } catch { /* no-op */ }
    finally { setSavePending(false); }
  }, [userId, savePending, saved, entity, redirectToAuthForAction, requireVerifiedForAction]);

  const handleFollow = useCallback(async () => {
    if (!userId) {
      redirectToAuthForAction("follow");
      return;
    }
    if (!requireVerifiedForAction("follow")) return;
    if (followPending) return;
    setFollowPending(true);
    try {
      const result = await followTarget({
        targetType: entity.type,
        targetId: entity.id || entity.slug || entity.url,
        targetSlug: entity.slug,
      });
      const nowFollowing = result?.followed ?? !following;
      setFollowing(nowFollowing);
      trackEvent("community_follow", {
        pageType: "article",
        entitySlug: entity.slug,
        entityType: entity.type,
        context: { action: nowFollowing ? "follow" : "unfollow", entity_title: entity.title },
      });
    } catch { /* no-op */ }
    finally { setFollowPending(false); }
  }, [userId, followPending, following, entity, redirectToAuthForAction, requireVerifiedForAction]);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(entity.url); } catch { /* no-op */ }
    setCopied(true);
    trackEvent("community_copy_link", {
      pageType: "article",
      entitySlug: entity.slug,
      entityType: entity.type,
      context: { entity_title: entity.title },
    });
    setTimeout(() => setCopied(false), 2000);
  }, [entity]);

  const handleShare = useCallback(() => {
    setShareOpen(true);
  }, []);

  const handleComment = useCallback(() => {
    if (!userId) {
      onClose();
      window.location.assign(buildCommunityAuthUrl());
      return;
    }

    if (!requireVerifiedForAction("comment")) return;

    onClose();
    setTimeout(() => onComment?.(), 300);
  }, [userId, onClose, onComment, requireVerifiedForAction]);

  const handleReport = useCallback(async (reason: ReportReason) => {
    if (!userId) {
      onClose();
      window.location.assign(buildCommunityAuthUrl());
      return;
    }
    if (reporting) return;
    if (!requireVerifiedForAction("report")) return;
    setReporting(true);
    try {
      await reportComment({
        commentId: "",
        reason,
        details: `Reported entity: ${entity.type}/${entity.slug || entity.id} — "${entity.title}"`,
      });
      setReportDone(true);
      trackEvent("community_report", {
        pageType: "article",
        entitySlug: entity.slug,
        entityType: entity.type,
        context: { report_reason: reason, entity_title: entity.title },
      });
      setTimeout(() => {
        setReportOpen(false);
        setReportDone(false);
        onClose();
      }, 1500);
    } catch { /* no-op */ }
    finally { setReporting(false); }
  }, [userId, reporting, entity, onClose]);

  const handleReportBack = useCallback(() => {
    setReportOpen(false);
    setReportDone(false);
  }, []);

  if (!open) return null;

  return (
    <>
      <Portal>
        <div className="share-sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
          <div ref={sheetRef} className="share-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="share-handle" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              <div className="share-handle-bar" />
            </div>

            <div ref={scrollRef} data-scroll-lock="container" className="share-sheet-scroll">
              {/* Header */}
              <div className="share-header">
                <div>
                  <div className="share-title">
                    {reportOpen ? "Report this content" : entity.title}
                  </div>
                  {!reportOpen && (
                    <div className="share-sub">
                      {entity.type === "article" ? "Article" : entity.type} · Choose an action
                    </div>
                  )}
                </div>
                <button
                  className="share-close-btn"
                  onClick={() => {
                    if (reportOpen) handleReportBack();
                    else onClose();
                  }}
                  aria-label="Close"
                >
                  <i className="ri-close-line text-[16px]" />
                </button>
              </div>

              {/* Report view */}
              {reportOpen ? (
                <div className="px-5 pb-6">
                  {reportDone ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--wk-brand-soft)] flex items-center justify-center">
                        <i className="ri-check-line text-[22px] text-[var(--wk-brand)]" />
                      </div>
                      <p className="text-[14px] font-bold text-[var(--wk-text)] mb-1">Report submitted</p>
                      <p className="text-[12px] text-[var(--wk-text-muted)]">Thanks for helping keep the community safe.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[12px] text-[var(--wk-text-muted)] mb-4 px-1">
                        Select a reason for reporting this content. Your report will be reviewed by our moderation team.
                      </p>
                      <div className="space-y-0.5">
                        {REPORT_REASONS.map((r) => (
                          <button
                            key={r.value}
                            onClick={() => handleReport(r.value)}
                            disabled={reporting}
                            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-colors hover:bg-[var(--wk-surface)] active:bg-[var(--wk-surface-strong)] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[var(--wk-surface)] flex items-center justify-center text-[15px] text-[var(--wk-text-muted)] shrink-0">
                              <i className={r.icon} />
                            </div>
                            <span className="text-[14px] font-medium text-[var(--wk-text)] flex-1">{r.label}</span>
                            <i className="ri-arrow-right-s-line text-[16px] text-[var(--wk-text-faint)]" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Actions list */
                <div className="pb-4">
                  <ActionRow
                    icon="ri-bookmark-line"
                    activeIcon="ri-bookmark-fill"
                    label={saved ? "Saved" : "Save"}
                    onClick={handleSave}
                    active={saved}
                    pending={savePending}
                  />
                  <ActionRow
                    icon="ri-user-add-line"
                    activeIcon="ri-user-follow-line"
                    label={following ? "Following" : "Follow"}
                    onClick={handleFollow}
                    active={following}
                    pending={followPending}
                  />
                  <ActionRow
                    icon="ri-share-forward-line"
                    label="Share"
                    onClick={handleShare}
                  />
                  {onComment && (
                    <ActionRow
                      icon="ri-chat-1-line"
                      label="Comment"
                      onClick={handleComment}
                    />
                  )}
                  <ActionRow
                    icon={copied ? "ri-check-line" : "ri-link"}
                    label={copied ? "Copied!" : "Copy Link"}
                    onClick={handleCopy}
                    active={copied}
                  />
                  <ActionRow
                    icon="ri-edit-line"
                    label="Suggest Correction"
                    onClick={() => setContributionOpen(true)}
                  />
                  <div className="h-px bg-[var(--wk-border)] mx-5 my-1" />
                  <ActionRow
                    icon="ri-flag-line"
                    label="Report"
                    onClick={() => setReportOpen(true)}
                    danger
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Portal>

      {/* Nested ShareSheet */}
      <ShareSheet
        item={{
          title: entity.title,
          subtitle: entity.subtitle,
          description: entity.description,
          imageUrl: entity.imageUrl,
          url: entity.url,
          type: entity.type === "article" ? "article" : "page",
        }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onComment={onComment}
      />

      {/* Contribution sub-sheet */}
      <ContributionSheet
        entity={entity}
        open={contributionOpen}
        onClose={() => setContributionOpen(false)}
        userId={userId}
      />
    </>
  );
}
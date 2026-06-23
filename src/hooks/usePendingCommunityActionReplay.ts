import { useEffect, useRef } from "react";
import { followTarget, saveEntity } from "@/services/community";
import { consumePendingCommunityAction } from "@/services/community/authIntent";
import { trackEvent } from "@/services/analytics";

export function usePendingCommunityActionReplay(userId?: string): void {
  const replayingRef = useRef(false);

  useEffect(() => {
    if (!userId || replayingRef.current) return;

    const pending = consumePendingCommunityAction();
    if (!pending) return;

    replayingRef.current = true;

    void (async () => {
      try {
        if (pending.action === "save") {
          await saveEntity({
            entityType: pending.entity.type,
            entityId: pending.entity.id,
            entitySlug: pending.entity.slug,
            entityUrl: pending.entity.url,
            title: pending.entity.title,
            subtitle: pending.entity.subtitle,
            imageUrl: pending.entity.imageUrl || undefined,
          });
        } else {
          await followTarget({
            targetType: pending.entity.type,
            targetId: pending.entity.id || pending.entity.slug || pending.entity.url,
            targetSlug: pending.entity.slug,
          });
        }

        trackEvent("community_pending_action_replayed", {
          pageType: "community",
          entitySlug: pending.entity.slug,
          entityType: pending.entity.type,
          context: {
            action: pending.action,
            entity_title: pending.entity.title,
            return_to: pending.returnTo,
          },
          userId,
        });

        window.dispatchEvent(new CustomEvent("wk_community_action_replayed", { detail: pending }));
      } catch (err) {
        console.warn("[community] pending action replay failed:", err);
      } finally {
        replayingRef.current = false;
      }
    })();
  }, [userId]);
}

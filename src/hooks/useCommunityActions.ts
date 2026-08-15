import { useState, useCallback } from 'react';
import type { CommunityEntity, ReactionType, ReportReason } from '@/services/community';
import {
  voteComment,
  reactToTarget,
  reportComment,
  followTarget,
  setFollowState,
  saveEntity,
  setSavedState,
  createContribution,
} from '@/services/community';
import { useAuthUser } from '@/hooks/useAuthUser';
import { buildCommunityAuthUrl, stashPendingCommunityAction } from '@/services/community/authIntent';
import { buildVerifyEmailUrl } from '@/services/auth/accountVerification';

function redirectTo(url: string): void {
  if (typeof window !== 'undefined') window.location.assign(url);
}

export function useCommentActions(userId?: string) {
  const authUser = useAuthUser();
  const effectiveUserId = userId || authUser.id;
  const [votingCommentId, setVotingCommentId] = useState<string | null>(null);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);

  const requireVerified = useCallback(() => {
    if (!effectiveUserId || authUser.loading) return false;

    if (!authUser.isEmailVerified) {
      redirectTo(buildVerifyEmailUrl(undefined, authUser.email));
      return false;
    }

    return true;
  }, [effectiveUserId, authUser.loading, authUser.isEmailVerified, authUser.email]);

  const vote = useCallback(
    async (commentId: string, value: number) => {
      if (!requireVerified()) return null;
      setVotingCommentId(commentId);
      try {
        const result = await voteComment({ commentId, voteValue: value });
        return result;
      } finally {
        setVotingCommentId(null);
      }
    },
    [requireVerified]
  );

  const react = useCallback(
    async (commentId: string, reactionType: ReactionType) => {
      if (!requireVerified()) return null;
      setReactingCommentId(commentId);
      try {
        const result = await reactToTarget({
          targetType: 'comment',
          targetId: commentId,
          reactionType,
        });
        return result;
      } finally {
        setReactingCommentId(null);
      }
    },
    [requireVerified]
  );

  const report = useCallback(
    async (commentId: string, reason: ReportReason, details?: string) => {
      if (!requireVerified()) return null;
      setReportingCommentId(commentId);
      try {
        const result = await reportComment({ commentId, reason, details });
        return result;
      } finally {
        setReportingCommentId(null);
      }
    },
    [requireVerified]
  );

  return {
    vote,
    react,
    report,
    votingCommentId,
    reactingCommentId,
    reportingCommentId,
  };
}

export function useEntityActions(userId?: string) {
  const authUser = useAuthUser();
  const effectiveUserId = userId || authUser.id;
  const [loading, setLoading] = useState(false);

  const requireVerified = useCallback((pending?: { action: 'save' | 'follow'; entity: CommunityEntity }) => {
    if (!effectiveUserId || authUser.loading) return false;

    if (!authUser.isEmailVerified) {
      if (pending) stashPendingCommunityAction(pending);
      redirectTo(buildVerifyEmailUrl(undefined, authUser.email));
      return false;
    }

    return true;
  }, [effectiveUserId, authUser.loading, authUser.isEmailVerified, authUser.email]);

  const follow = useCallback(
    async (targetType: string, targetId: string, targetSlug?: string) => {
      const pendingEntity: CommunityEntity = {
        type: targetType as CommunityEntity['type'],
        id: targetId,
        slug: targetSlug,
        url: typeof window !== 'undefined' ? window.location.href : '/',
        title: targetSlug || targetId,
      };

      if (!effectiveUserId) {
        stashPendingCommunityAction({ action: 'follow', entity: pendingEntity });
        redirectTo(buildCommunityAuthUrl());
        return null;
      }

      if (!requireVerified({ action: 'follow', entity: pendingEntity })) return null;

      setLoading(true);
      try {
        const result = await followTarget({ targetType, targetId, targetSlug });
        return result;
      } finally {
        setLoading(false);
      }
    },
    [effectiveUserId, requireVerified]
  );

  const save = useCallback(
    async (entity: {
      entityType: string;
      entityId?: string;
      entitySlug?: string;
      entityUrl?: string;
      title: string;
      subtitle?: string;
      imageUrl?: string;
    }) => {
      const pendingEntity: CommunityEntity = {
        type: entity.entityType as CommunityEntity['type'],
        id: entity.entityId,
        slug: entity.entitySlug,
        url: entity.entityUrl || (typeof window !== 'undefined' ? window.location.href : '/'),
        title: entity.title,
        subtitle: entity.subtitle,
        imageUrl: entity.imageUrl,
      };

      if (!effectiveUserId) {
        stashPendingCommunityAction({ action: 'save', entity: pendingEntity });
        redirectTo(buildCommunityAuthUrl());
        return null;
      }

      if (!requireVerified({ action: 'save', entity: pendingEntity })) return null;

      setLoading(true);
      try {
        const result = await saveEntity({
          entityType: entity.entityType as CommunityEntity['type'],
          entityId: entity.entityId,
          entitySlug: entity.entitySlug,
          entityUrl: entity.entityUrl,
          title: entity.title,
          subtitle: entity.subtitle,
          imageUrl: entity.imageUrl,
        });
        return result;
      } finally {
        setLoading(false);
      }
    },
    [effectiveUserId, requireVerified]
  );

  const setFollow = useCallback(
    async (
      targetType: string,
      targetId: string,
      targetSlug: string | undefined,
      followed: boolean
    ) => {
      const pendingEntity: CommunityEntity = {
        type:
          targetType as CommunityEntity['type'],
        id:
          targetId,
        slug:
          targetSlug,
        url:
          typeof window !== 'undefined'
            ? window.location.href
            : '/',
        title:
          targetSlug || targetId,
      };

      if (!effectiveUserId) {
        if (followed) {
          stashPendingCommunityAction({
            action: 'follow',
            entity: pendingEntity,
          });
        }

        redirectTo(
          buildCommunityAuthUrl()
        );

        return null;
      }

      if (
        !requireVerified(
          followed
            ? {
                action: 'follow',
                entity: pendingEntity,
              }
            : undefined
        )
      ) {
        return null;
      }

      setLoading(true);

      try {
        return await setFollowState({
          targetType,
          targetId,
          targetSlug,
          followed,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      effectiveUserId,
      requireVerified,
    ]
  );

  const setSaved = useCallback(
    async (
      entity: {
        entityType: string;
        entityId: string;
        entitySlug?: string;
        entityUrl?: string;
        title: string;
        subtitle?: string;
        imageUrl?: string;
      },
      saved: boolean
    ) => {
      const pendingEntity: CommunityEntity = {
        type:
          entity.entityType as CommunityEntity['type'],
        id:
          entity.entityId,
        slug:
          entity.entitySlug,
        url:
          entity.entityUrl ||
          (
            typeof window !== 'undefined'
              ? window.location.href
              : '/'
          ),
        title:
          entity.title,
        subtitle:
          entity.subtitle,
        imageUrl:
          entity.imageUrl,
      };

      if (!effectiveUserId) {
        if (saved) {
          stashPendingCommunityAction({
            action: 'save',
            entity: pendingEntity,
          });
        }

        redirectTo(
          buildCommunityAuthUrl()
        );

        return null;
      }

      if (
        !requireVerified(
          saved
            ? {
                action: 'save',
                entity: pendingEntity,
              }
            : undefined
        )
      ) {
        return null;
      }

      setLoading(true);

      try {
        return await setSavedState({
          entityType:
            entity.entityType as CommunityEntity['type'],
          entityId:
            entity.entityId,
          entitySlug:
            entity.entitySlug,
          entityUrl:
            entity.entityUrl,
          title:
            entity.title,
          subtitle:
            entity.subtitle,
          imageUrl:
            entity.imageUrl,
          saved,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      effectiveUserId,
      requireVerified,
    ]
  );

  const react = useCallback(
    async (
      targetType: string,
      targetId: string,
      reactionType: ReactionType,
    ) => {
      if (!effectiveUserId) {
        redirectTo(buildCommunityAuthUrl());
        return null;
      }
      if (!requireVerified()) return null;
      setLoading(true);
      try {
        return await reactToTarget({
          targetType,
          targetId,
          reactionType,
        });
      } finally {
        setLoading(false);
      }
    },
    [effectiveUserId, requireVerified],
  );

  const contribute = useCallback(
    async (input: {
      sourceCommentId?: string;
      entityType: string;
      entityId?: string;
      entitySlug?: string;
      contributionType: string;
      payload?: Record<string, unknown>;
    }) => {
      if (!effectiveUserId) {
        redirectTo(buildCommunityAuthUrl());
        return null;
      }

      if (!requireVerified()) return null;

      setLoading(true);
      try {
        const result = await createContribution({
          sourceCommentId: input.sourceCommentId,
          entityType: input.entityType as CommunityEntity['type'],
          entityId: input.entityId,
          entitySlug: input.entitySlug,
          contributionType: input.contributionType,
          payload: input.payload,
        });
        return result;
      } finally {
        setLoading(false);
      }
    },
    [effectiveUserId, requireVerified]
  );

  return {
    follow,
    setFollow,
    save,
    setSaved,
    react,
    contribute,
    loading,
  };
}

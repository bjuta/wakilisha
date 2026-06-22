import { useState, useCallback } from 'react';
import type { CommunityEntity, ReactionType, ReportReason } from '@/services/community';
import {
  voteComment,
  reactToTarget,
  reportComment,
  followTarget,
  saveEntity,
  createContribution,
} from '@/services/community';

export function useCommentActions(userId?: string) {
  const [votingCommentId, setVotingCommentId] = useState<string | null>(null);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);

  const vote = useCallback(
    async (commentId: string, value: number) => {
      if (!userId) return null;
      setVotingCommentId(commentId);
      try {
        const result = await voteComment({ commentId, voteValue: value });
        return result;
      } finally {
        setVotingCommentId(null);
      }
    },
    [userId]
  );

  const react = useCallback(
    async (commentId: string, reactionType: ReactionType) => {
      if (!userId) return null;
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
    [userId]
  );

  const report = useCallback(
    async (commentId: string, reason: ReportReason, details?: string) => {
      if (!userId) return null;
      setReportingCommentId(commentId);
      try {
        const result = await reportComment({ commentId, reason, details });
        return result;
      } finally {
        setReportingCommentId(null);
      }
    },
    [userId]
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
  const [loading, setLoading] = useState(false);

  const follow = useCallback(
    async (targetType: string, targetId: string, targetSlug?: string) => {
      if (!userId) return null;
      setLoading(true);
      try {
        const result = await followTarget({ targetType, targetId, targetSlug });
        return result;
      } finally {
        setLoading(false);
      }
    },
    [userId]
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
      if (!userId) return null;
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
    [userId]
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
      if (!userId) return null;
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
    [userId]
  );

  return {
    follow,
    save,
    contribute,
    loading,
  };
}
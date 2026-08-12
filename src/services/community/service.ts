import { supabase } from '@/lib/supabase';
import type {
  CommunityEntity,
  CommunityProfile,
  CommunityThread,
  CommunityComment,
  CommunityContribution,
  CommunityActivity,
  CreateCommentInput,
  CreateTrackMomentCommentInput,
  CreateContextAnchorCommentInput,
  ContextAnchorCommentQuery,
  ContextAnchorSummaryItem,
  TrackMomentSummaryItem,
  VoteInput,
  ReactInput,
  ReportInput,
  FollowInput,
  SetFollowStateInput,
  SaveEntityInput,
  SetSavedStateInput,
  CreateContributionInput,
  CommentSortOptions,
  ThreadResult,
  CommentResult,
  VoteResult,
  ReactionResult,
  CommunityNotification,
  ReactionType,
  CommunityPublicReactionTarget,
  CommunityPublicReactionTargetType,
  CommunityPublicReactionState,
} from './types';
import {
  hydrateFollowingPresentation,
  mapCommunityFollowRows,
  type FollowingPresentationItem,
} from './followingPresentation';

function isDuplicateThreadConflict(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const text = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();

  return err?.code === "23505" || text.includes("duplicate key") || text.includes("community_threads_entity_type_entity_id_key");
}

function asArrayPayload<T = any>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    if (Array.isArray(record.notifications)) return record.notifications as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
  }

  return [];
}

export async function getOrCreateThread(entity: CommunityEntity): Promise<ThreadResult> {
  const existing = await getThreadByEntity(entity.type, entity.id || undefined, entity.slug || undefined);
  if (existing) {
    return {
      thread: existing,
      created: false,
    };
  }

  const { data, error } = await supabase.rpc('community_get_or_create_thread', {
    p_entity_type: entity.type,
    p_entity_id: entity.id || null,
    p_entity_slug: entity.slug || null,
    p_entity_url: entity.url,
    p_title: entity.title,
  });

  if (error) {
    if (isDuplicateThreadConflict(error)) {
      const recovered = await getThreadByEntity(entity.type, entity.id || undefined, entity.slug || undefined);
      if (recovered) {
        return {
          thread: recovered,
          created: false,
        };
      }
    }

    throw error;
  }

  return {
    thread: mapThread(data.thread),
    created: data.created,
  };
}

export async function createComment(input: CreateCommentInput): Promise<CommentResult> {
  const { data, error } = await supabase.rpc('community_create_comment', {
    p_thread_id: input.threadId,
    p_parent_id: input.parentId || null,
    p_body_markdown: input.bodyMarkdown,
    p_body_plain: input.bodyPlain || null,
    p_body_html: input.bodyHtml || null,
    p_status: input.status || 'visible',
  });
  if (error) throw error;
  return { comment: mapComment(data.comment) };
}

export async function createTrackMomentComment(input: CreateTrackMomentCommentInput): Promise<CommentResult> {
  const { data, error } = await supabase.rpc('community_create_track_moment_comment', {
    p_thread_id: input.threadId,
    p_body_markdown: input.bodyMarkdown,
    p_body_plain: input.bodyPlain || input.bodyMarkdown,
    p_body_html: input.bodyHtml || null,
    p_anchor_time_ms: Math.max(0, Math.round(input.anchorTimeMs)),
    p_anchor_end_time_ms: input.anchorEndTimeMs != null ? Math.max(0, Math.round(input.anchorEndTimeMs)) : null,
    p_anchor_label: input.anchorLabel || null,
  });
  if (error) throw error;
  return { comment: mapComment(data.comment) };
}

export async function getTrackMomentComments(
  threadId: string,
  anchorTimeMs?: number | null,
  windowMs: number = 2500,
  limit: number = 30
): Promise<CommunityComment[]> {
  const { data, error } = await supabase.rpc('community_get_track_moment_comments', {
    p_thread_id: threadId,
    p_anchor_time_ms: anchorTimeMs == null ? null : Math.max(0, Math.round(anchorTimeMs)),
    p_window_ms: Math.max(0, Math.round(windowMs)),
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((row: any) => mapComment(row));
}

export async function getTrackMomentSummary(
  threadId: string,
  limit: number = 6
): Promise<TrackMomentSummaryItem[]> {
  const { data, error } = await supabase.rpc('community_get_track_moment_summary', {
    p_thread_id: threadId,
    p_limit: limit,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    anchorTimeMs: Number(row.anchor_time_ms) || 0,
    anchorLabel: String(row.anchor_label || ''),
    commentCount: Number(row.comment_count) || 0,
    reactionCount: Number(row.reaction_count) || 0,
    score: Number(row.score) || 0,
    latestCommentAt: String(row.latest_comment_at || ''),
  }));
}

export async function createContextAnchorComment(input: CreateContextAnchorCommentInput): Promise<CommentResult> {
  const { data, error } = await supabase.rpc('community_create_context_anchor_comment', {
    p_thread_id: input.threadId,
    p_body_markdown: input.bodyMarkdown,
    p_body_plain: input.bodyPlain || input.bodyMarkdown,
    p_body_html: input.bodyHtml || null,
    p_anchor_type: input.anchorType,
    p_context_entity_type: input.contextEntityType,
    p_context_entity_id: input.contextEntityId || null,
    p_context_entity_slug: input.contextEntitySlug || null,
    p_context_label: input.contextLabel || null,
    p_anchor_label: input.anchorLabel || input.contextLabel || null,
  });
  if (error) throw error;
  return { comment: mapComment(data.comment) };
}

export async function getContextAnchorComments(input: ContextAnchorCommentQuery): Promise<CommunityComment[]> {
  const { data, error } = await supabase.rpc('community_get_context_anchor_comments', {
    p_thread_id: input.threadId,
    p_anchor_type: input.anchorType,
    p_context_entity_type: input.contextEntityType || null,
    p_context_entity_id: input.contextEntityId || null,
    p_context_entity_slug: input.contextEntitySlug || null,
    p_limit: input.limit || 30,
  });
  if (error) throw error;
  return (data || []).map((row: any) => mapComment(row));
}

export async function getContextAnchorSummary(
  threadId: string,
  anchorType?: 'release_track' | 'chart_entry' | 'playlist_track' | null,
  limit: number = 8
): Promise<ContextAnchorSummaryItem[]> {
  const { data, error } = await supabase.rpc('community_get_context_anchor_summary', {
    p_thread_id: threadId,
    p_anchor_type: anchorType || null,
    p_limit: limit,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    anchorType: row.anchor_type as ContextAnchorSummaryItem['anchorType'],
    contextEntityType: row.context_entity_type ? String(row.context_entity_type) : null,
    contextEntityId: row.context_entity_id ? String(row.context_entity_id) : null,
    contextEntitySlug: row.context_entity_slug ? String(row.context_entity_slug) : null,
    contextLabel: String(row.context_label || row.anchor_label || ''),
    anchorLabel: String(row.anchor_label || row.context_label || ''),
    commentCount: Number(row.comment_count) || 0,
    reactionCount: Number(row.reaction_count) || 0,
    score: Number(row.score) || 0,
    latestCommentAt: String(row.latest_comment_at || ''),
  }));
}

export async function softDeleteComment(commentId: string): Promise<CommentResult> {
  const { data, error } = await supabase.rpc('community_soft_delete_comment', {
    p_comment_id: commentId,
  });
  if (error) throw error;
  return { comment: mapComment(data.comment) };
}

export async function updateComment(input: {
  commentId: string;
  bodyMarkdown: string;
  bodyPlain?: string;
  bodyHtml?: string | null;
}): Promise<CommentResult> {
  const body = input.bodyMarkdown.trim();
  const { data, error } = await supabase.rpc('community_update_comment', {
    p_comment_id: input.commentId,
    p_body_markdown: body,
    p_body_plain: input.bodyPlain?.trim() || body,
    p_body_html: input.bodyHtml || null,
  });
  if (error) throw error;
  return { comment: mapComment(data.comment) };
}

export async function voteComment(input: VoteInput): Promise<VoteResult> {
  const { data, error } = await supabase.rpc('community_vote_comment', {
    p_comment_id: input.commentId,
    p_vote_value: input.voteValue,
  });
  if (error) throw error;
  return {
    voteValue: data.vote_value,
    existing: data.existing,
    delta: data.delta,
  };
}

export async function reactToTarget(input: ReactInput): Promise<ReactionResult> {
  const { data, error } = await supabase.rpc('community_react_to_target', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reaction_type: input.reactionType,
  });
  if (error) throw error;
  return {
    created: data.created,
    reactionType: data.reaction_type as ReactionType,
  };
}

function isCommunityPublicReactionTargetType(
  value: string,
): value is CommunityPublicReactionTargetType {
  return (
    value === 'article'
    || value === 'playlist'
    || value === 'release'
  );
}

function decodeCommunityPublicReactionState(
  value: unknown,
): CommunityPublicReactionState {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new Error(
      'Reaction state returned an invalid target.',
    );
  }

  const record =
    value as Record<string, unknown>;

  const targetType =
    typeof record.target_type === 'string'
      ? record.target_type
      : '';

  const targetId =
    typeof record.target_id === 'string'
      ? record.target_id
      : '';

  const reactionCount =
    typeof record.reaction_count === 'number'
    && Number.isFinite(record.reaction_count)
      ? Math.max(
          0,
          Math.floor(record.reaction_count),
        )
      : null;

  if (
    !isCommunityPublicReactionTargetType(
      targetType,
    )
    || !targetId
    || reactionCount === null
    || !Array.isArray(record.reactions)
  ) {
    throw new Error(
      'Reaction state returned an invalid target.',
    );
  }

  const reactions =
    record.reactions.map(
      (reaction): CommunityPublicReactionState['reactions'][number] => {
        if (
          !reaction
          || typeof reaction !== 'object'
          || Array.isArray(reaction)
        ) {
          throw new Error(
            'Reaction state returned an invalid reaction.',
          );
        }

        const reactionRecord =
          reaction as Record<string, unknown>;

        const reactionType =
          typeof reactionRecord.reaction_type === 'string'
            ? reactionRecord.reaction_type
            : '';

        const count =
          typeof reactionRecord.count === 'number'
          && Number.isFinite(reactionRecord.count)
            ? Math.max(
                0,
                Math.floor(reactionRecord.count),
              )
            : null;

        const viewerReacted =
          reactionRecord.viewer_reacted;

        if (
          !reactionType
          || count === null
          || typeof viewerReacted !== 'boolean'
        ) {
          throw new Error(
            'Reaction state returned an invalid reaction.',
          );
        }

        return {
          reactionType,
          count,
          viewerReacted,
        };
      },
    );

  return {
    targetType,
    targetId,
    reactionCount,
    reactions,
  };
}

export async function getReactionStateForPublicTargets(
  targets: CommunityPublicReactionTarget[],
): Promise<CommunityPublicReactionState[]> {
  if (targets.length === 0) {
    return [];
  }

  const uniqueTargets =
    Array.from(
      new Map(
        targets.map(
          (target) => [
            `${target.targetType}:${target.targetId}`,
            target,
          ],
        ),
      ).values(),
    );

  const states:
    CommunityPublicReactionState[] = [];

  for (
    let offset = 0;
    offset < uniqueTargets.length;
    offset += 100
  ) {
    const batch =
      uniqueTargets.slice(
        offset,
        offset + 100,
      );

    const { data, error } =
      await supabase.rpc(
        'community_get_reaction_state_for_public_targets',
        {
          p_targets:
            batch.map(
              (target) => ({
                target_type:
                  target.targetType,
                target_id:
                  target.targetId,
              }),
            ),
        },
      );

    if (error) {
      throw error;
    }

    if (
      !data
      || typeof data !== 'object'
      || Array.isArray(data)
      || !Array.isArray(
        (
          data as Record<string, unknown>
        ).targets,
      )
    ) {
      throw new Error(
        'Reaction state returned an invalid response.',
      );
    }

    const decoded =
      (
        data as {
          targets: unknown[];
        }
      ).targets.map(
        decodeCommunityPublicReactionState,
      );

    if (decoded.length !== batch.length) {
      throw new Error(
        'Reaction state returned an incomplete response.',
      );
    }

    states.push(
      ...decoded,
    );
  }

  return states;
}

export async function reportComment(input: ReportInput): Promise<{ report: unknown }> {
  const { data, error } = await supabase.rpc('community_report_comment', {
    p_comment_id: input.commentId,
    p_reason: input.reason,
    p_details: input.details || '',
  });
  if (error) throw error;
  return { report: data.report };
}

export async function setFollowState(
  input: SetFollowStateInput
): Promise<{ followed: boolean }> {
  const { data, error } = await supabase.rpc(
    'community_set_follow_state',
    {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_target_slug: input.targetSlug || '',
      p_followed: input.followed,
    }
  );

  if (error) throw error;

  return {
    followed:
      Boolean(
        (data as { followed?: boolean } | null)
          ?.followed
      ),
  };
}

export async function setSavedState(
  input: SetSavedStateInput
): Promise<{ saved: boolean }> {
  const { data, error } = await supabase.rpc(
    'community_set_saved_state',
    {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_entity_slug: input.entitySlug || '',
      p_entity_url: input.entityUrl || '',
      p_title: input.title,
      p_subtitle: input.subtitle || '',
      p_image_url: input.imageUrl || '',
      p_saved: input.saved,
    }
  );

  if (error) throw error;

  return {
    saved:
      Boolean(
        (data as { saved?: boolean } | null)
          ?.saved
      ),
  };
}

export async function followTarget(input: FollowInput): Promise<{ followed: boolean }> {
  const { data, error } = await supabase.rpc('community_follow_target', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_target_slug: input.targetSlug || null,
  });
  if (error) throw error;
  return { followed: data.followed };
}

export async function saveEntity(input: SaveEntityInput): Promise<{ saved: boolean }> {
  const { data, error } = await supabase.rpc('community_save_entity', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId || null,
    p_entity_slug: input.entitySlug || null,
    p_entity_url: input.entityUrl || null,
    p_title: input.title,
    p_subtitle: input.subtitle || null,
    p_image_url: input.imageUrl || null,
  });
  if (error) throw error;
  return { saved: data.saved };
}

export async function createContribution(input: CreateContributionInput): Promise<{ contribution: unknown }> {
  const { data, error } = await supabase.rpc('community_create_contribution', {
    p_source_comment_id: input.sourceCommentId || null,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId || null,
    p_entity_slug: input.entitySlug || null,
    p_contribution_type: input.contributionType,
    p_payload: input.payload || {},
  });
  if (error) throw error;
  return { contribution: data.contribution };
}

export async function markNotificationRead(notificationId: string): Promise<{ notification: CommunityNotification }> {
  const { data, error } = await supabase.rpc('community_mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
  return { notification: mapNotification(data.notification) };
}

// ── Notification-enhanced queries ─────────────────────────────────────────

export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc('community_get_unread_count');
  if (error) throw error;
  return (data as any)?.count ?? 0;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('community_mark_all_read');
  if (error) throw error;
}

export async function getNotificationsWithActors(userId: string, limit: number = 30): Promise<(CommunityNotification & { actor: CommunityProfile | null })[]> {
  const { data, error } = await supabase.rpc('community_get_user_notifications', {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) throw error;

  const notifs = asArrayPayload<Record<string, unknown>>(data);
  if (notifs.length === 0) return [];

  const actorIds = [...new Set(notifs.map((n: any) => n.actor_id).filter(Boolean))];
  let profileMap: Record<string, CommunityProfile> = {};

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.rpc('community_get_profiles_batch', {
      p_user_ids: actorIds,
    });
    if (profiles) {
      Object.entries(profiles as Record<string, any>).forEach(([uid, p]) => {
        profileMap[uid] = mapProfile(p);
      });
    }
  }

  return notifs.map((row: any) => ({
    ...mapNotification(row),
    actor: row.actor_id ? profileMap[row.actor_id] || null : null,
  }));
}

export async function getNotification(id: string): Promise<CommunityNotification | null> {
  const { data, error } = await supabase.rpc('community_get_notification_by_id', {
    p_notification_id: id,
  });
  if (error || !data) return null;
  return mapNotification(data);
}

export async function getThreadComments(
  threadId: string,
  options: CommentSortOptions = {}
): Promise<CommunityComment[]> {
  const { sortBy = 'best', limit = 50, offset = 0 } = options;

  const { data, error } = await supabase.rpc('community_get_thread_comments', {
    p_thread_id: threadId,
    p_sort_by: sortBy,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data || []).map((row: any) => mapComment(row));
}

export async function getCommentReplies(commentId: string, limit: number = 3): Promise<CommunityComment[]> {
  const { data, error } = await supabase.rpc('community_get_comment_replies', {
    p_parent_id: commentId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((row: any) => mapComment(row));
}

export async function getUserProfile(userId: string): Promise<CommunityProfile | null> {
  const { data, error } = await supabase.rpc('community_get_user_profile', {
    p_user_id: userId,
  });
  if (error || !data) return null;
  return mapProfile(data);
}

export async function getUserNotifications(userId: string, limit: number = 20): Promise<CommunityNotification[]> {
  const { data, error } = await supabase.rpc('community_get_user_notifications', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  return asArrayPayload<Record<string, unknown>>(data).map((row: any) => mapNotification(row));
}

export async function getUserComments(userId: string, limit: number = 20): Promise<CommunityComment[]> {
  const { data, error } = await supabase.rpc('community_get_user_comments', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((row: any) => mapComment(row));
}

export async function getUserReplies(userId: string, limit: number = 20): Promise<CommunityComment[]> {
  const { data, error } = await supabase.rpc('community_get_user_replies', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((row: any) => mapComment(row));
}

export async function getPublicPersonCommunityActivity(
  personResourceId: string,
  activityKind: 'comment' | 'reply',
  limit: number = 20,
): Promise<CommunityComment[]> {
  const { data, error } = await supabase.rpc(
    'list_public_person_community_activity',
    {
      p_person_resource_id: personResourceId,
      p_activity_kind: activityKind,
      p_limit: Math.min(Math.max(limit, 1), 50),
    },
  );

  if (error) {
    throw new Error(
      `Failed to load public Person community activity: ${error.message}`,
    );
  }

  return (data || []).map(
    (row: any) => mapComment(row),
  );
}

export async function getUserProfileWithStats(userId: string): Promise<CommunityProfile | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;
  // Fetch live counts
  const { data: stats } = await supabase.rpc('community_get_user_stats', { p_user_id: userId });
  return {
    ...profile,
    commentCount: (stats as any)?.comment_count ?? profile.commentCount,
    contributionCount: profile.contributionCount,
  };
}

export async function getUserFollows(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc('community_get_user_follows', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data || [];
}

export async function getUserFollowing(
  userId: string
): Promise<FollowingPresentationItem[]> {
  const rows = mapCommunityFollowRows(
    await getUserFollows(
      userId
    )
  );

  return hydrateFollowingPresentation(
    rows
  );
}

export async function getUserSaves(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc('community_get_user_saves', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data || [];
}

export async function getUserVotes(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('community_get_user_votes', {
    p_user_id: userId,
  });
  if (error) throw error;
  const result: Record<string, number> = {};
  if (data) {
    Object.entries(data as Record<string, number>).forEach(([k, v]) => {
      result[k] = v;
    });
  }
  return result;
}

export async function getUserReactions(userId: string): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.rpc('community_get_user_reactions', {
    p_user_id: userId,
  });
  if (error) throw error;
  const result: Record<string, string[]> = {};
  if (data) {
    Object.entries(data as Record<string, string[]>).forEach(([k, v]) => {
      result[k] = v;
    });
  }
  return result;
}

export async function createProfile(userId: string, username: string, displayName?: string): Promise<CommunityProfile> {
  const { data, error } = await supabase.rpc('community_create_profile', {
    p_user_id: userId,
    p_username: username.toLowerCase(),
    p_display_name: displayName || username,
  });
  if (error) throw error;
  return mapProfile(data);
}

export async function updateProfile(userId: string, updates: Partial<CommunityProfile>): Promise<CommunityProfile> {
  const { data, error } = await supabase.rpc('community_update_profile', {
    p_user_id: userId,
    p_display_name: updates.displayName || null,
    p_avatar_url: updates.avatarUrl || null,
    p_clear_avatar: updates.avatarUrl === null,
    p_cover_url: updates.coverUrl || null,
    p_clear_cover: updates.coverUrl === null,
    p_bio: updates.bio || null,
    p_country: updates.country || null,
    p_city: updates.city || null,
    p_is_public: updates.isPublic !== undefined ? updates.isPublic : null,
  });
  if (error) throw error;
  return mapProfile(data);
}

export async function getProfileByUsername(username: string): Promise<CommunityProfile | null> {
  const { data, error } = await supabase.rpc('community_get_profile_by_username', {
    p_username: username.toLowerCase(),
  });
  if (error || !data) return null;
  return mapProfile(data);
}

export async function getThreadByEntity(entityType: string, entityId?: string, entitySlug?: string): Promise<CommunityThread | null> {
  const { data, error } = await supabase.rpc('community_get_thread_by_entity', {
    p_entity_type: entityType,
    p_entity_id: entityId || null,
    p_entity_slug: entitySlug || null,
  });
  if (error || !data) return null;
  return mapThread(data);
}

export async function getCommentCount(entityType: string, entityId?: string, entitySlug?: string): Promise<number> {
  const { data, error } = await supabase.rpc('community_get_thread_by_entity', {
    p_entity_type: entityType,
    p_entity_id: entityId || null,
    p_entity_slug: entitySlug || null,
  });
  if (error || !data) return 0;
  return (data as any).comment_count || 0;
}

export async function getEntityContributions(
  entityType: string,
  entitySlug?: string,
  entityId?: string,
): Promise<CommunityContribution[]> {
  const { data, error } = await supabase.rpc('community_get_entity_contributions', {
    p_entity_type: entityType,
    p_entity_slug: entitySlug || null,
    p_entity_id: entityId || null,
  });
  if (error) throw error;
  return (data || []) as CommunityContribution[];
}

// Mappers
function mapProfile(row: Record<string, unknown>): CommunityProfile {
  const username =
    typeof row.username === "string" && row.username
      ? row.username
      : typeof row.username_normalized === "string"
        ? row.username_normalized
        : "";

  return {
    userId: String(row.user_id),
    username,
    displayName: row.display_name as string | null,
    avatarUrl: row.avatar_url as string | null,
    coverUrl: row.cover_url as string | null,
    bio: row.bio as string | null,
    country: row.country as string | null,
    city: row.city as string | null,
    roleLabels: (row.role_labels as string[]) || [],
    trustLevel: Number(row.trust_level) || 0,
    reputationScore: Number(row.reputation_score) || 0,
    commentCount: Number(row.comment_count) || 0,
    contributionCount: Number(row.contribution_count) || 0,
    isPublic: Boolean(row.is_public),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapThread(row: Record<string, unknown>): CommunityThread {
  return {
    id: String(row.id),
    entityType: String(row.entity_type) as CommunityEntity['type'],
    entityId: row.entity_id as string | null,
    entitySlug: row.entity_slug as string | null,
    entityUrl: row.entity_url as string | null,
    title: String(row.title),
    status: String(row.status) as CommunityThread['status'],
    commentCount: Number(row.comment_count) || 0,
    rootCommentCount: Number(row.root_comment_count) || 0,
    lastCommentAt: row.last_comment_at as string | null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapComment(row: Record<string, unknown>): CommunityComment {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    parentId: row.parent_id as string | null,
    rootId: row.root_id as string | null,
    authorId: String(row.author_id),
    author: null,
    bodyMarkdown: String(row.body_markdown),
    bodyPlain: row.body_plain as string | null,
    bodyHtml: row.body_html as string | null,
    depth: Number(row.depth) || 0,
    path: row.path as string | null,
    status: String(row.status) as CommunityComment['status'],
    isPinned: Boolean(row.is_pinned),
    isEditorPick: Boolean(row.is_editor_pick),
    upvoteCount: Number(row.upvote_count) || 0,
    downvoteCount: Number(row.downvote_count) || 0,
    replyCount: Number(row.reply_count) || 0,
    reactionCount: Number(row.reaction_count) || 0,
    reportCount: Number(row.report_count) || 0,
    score: Number(row.score) || 0,
    userVote: null,
    userReactions: [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    editedAt: row.edited_at as string | null,
    deletedAt: row.deleted_at as string | null,
    threadTitle: row.thread_title ? String(row.thread_title) : null,
    threadEntityType: (row.thread_entity_type as CommunityComment['threadEntityType']) ?? null,
    threadEntityId: row.thread_entity_id ? String(row.thread_entity_id) : null,
    threadEntitySlug: row.thread_entity_slug ? String(row.thread_entity_slug) : null,
    threadEntityUrl: row.thread_entity_url ? String(row.thread_entity_url) : null,
    anchorType: (row.anchor_type as CommunityComment['anchorType']) ?? null,
    anchorTimeMs: row.anchor_time_ms == null ? null : Number(row.anchor_time_ms),
    anchorEndTimeMs: row.anchor_end_time_ms == null ? null : Number(row.anchor_end_time_ms),
    anchorLabel: row.anchor_label ? String(row.anchor_label) : null,
    contextEntityType: row.context_entity_type ? String(row.context_entity_type) : null,
    contextEntityId: row.context_entity_id ? String(row.context_entity_id) : null,
    contextEntitySlug: row.context_entity_slug ? String(row.context_entity_slug) : null,
    contextLabel: row.context_label ? String(row.context_label) : null,
  };
}

function mapNotification(row: Record<string, unknown>): CommunityNotification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    actorId: row.actor_id as string | null,
    notificationType: String(row.notification_type),
    entityType: row.entity_type as string | null,
    entityId: row.entity_id as string | null,
    entitySlug: row.entity_slug as string | null,
    commentId: row.comment_id as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    readAt: row.read_at as string | null,
    createdAt: String(row.created_at),
  };
}

export async function hydrateCommentsWithUserState(comments: CommunityComment[], userId?: string): Promise<CommunityComment[]> {
  if (!userId || comments.length === 0) return comments;
  const commentIds = comments.map((c) => c.id);

  const [votesResult, reactionsResult, profilesResult] = await Promise.all([
    supabase.rpc('community_get_user_votes_for_comments', {
      p_user_id: userId,
      p_comment_ids: commentIds,
    }),
    supabase.rpc('community_get_user_reactions_for_comments', {
      p_user_id: userId,
      p_target_ids: commentIds,
    }),
    supabase.rpc('community_get_profiles_batch', { p_user_ids: [...new Set(comments.map((c) => c.authorId))] }),
  ]);

  const votes: Record<string, number> = {};
  if (votesResult.data) {
    votesResult.data.forEach((row: any) => {
      votes[row.comment_id] = row.vote_value;
    });
  }

  const reactions: Record<string, string[]> = {};
  if (reactionsResult.data) {
    reactionsResult.data.forEach((row: any) => {
      const existing = reactions[row.target_id] || [];
      existing.push(row.reaction_type);
      reactions[row.target_id] = existing;
    });
  }

  const profileMap: Record<string, CommunityProfile> = {};
  if (profilesResult.data) {
    Object.entries(profilesResult.data as Record<string, any>).forEach(([uid, p]) => {
      profileMap[uid] = mapProfile(p);
    });
  }

  return comments.map((c) => ({
    ...c,
    userVote: votes[c.id] ?? null,
    userReactions: reactions[c.id] || [],
    author: profileMap[c.authorId] || null,
  }));
}

export async function getMostDiscussed(limit: number = 6): Promise<CommunityThread[]> {
  const { data, error } = await supabase.rpc('community_get_most_discussed', {
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((row: any) => mapThread(row));
}

export async function getCommunityDigest(limit: number = 20): Promise<CommunityActivity[]> {
  const { data, error } = await supabase.rpc('community_get_digest', {
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: String(row.id),
    userId: String(row.user_id),
    activityType: String(row.activity_type),
    entityType: row.entity_type as string | null,
    entityId: row.entity_id as string | null,
    entitySlug: row.entity_slug as string | null,
    entityUrl: row.entity_url as string | null,
    entityTitle: row.entity_title as string | null,
    commentId: row.comment_id as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    visibility: String(row.visibility || 'public'),
    createdAt: String(row.created_at),
  }));
}

export async function hydrateCommentWithReplies(comment: CommunityComment, userId?: string, replyLimit: number = 3): Promise<CommunityComment> {
  const replies = await getCommentReplies(comment.id, replyLimit);
  const hydrated = await hydrateCommentsWithUserState(replies, userId);
  return { ...comment, children: hydrated };
}
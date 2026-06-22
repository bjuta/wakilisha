import { supabase } from '@/lib/supabase';
import type {
  CommunityComment,
  CommunityReport,
  CommunityContribution,
  CommunityModerationEvent,
  CommunityThread,
  CommentStatus,
} from './types';

// ── Types ─────────────────────────────────────────────────────────

export interface CommentsQueueFilters {
  status?: CommentStatus | 'all';
  search?: string;
  sort?: 'newest' | 'oldest' | 'most_reported' | 'most_votes';
  limit?: number;
  offset?: number;
}

export interface ReportsQueueFilters {
  status?: string;
  reason?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface ContributionsQueueFilters {
  status?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface ModerationLogFilters {
  action?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface CommentsQueueResult {
  comments: CommunityComment[];
  total: number;
}

export interface ReportsQueueResult {
  reports: CommunityReport[];
  total: number;
}

export interface ContributionsQueueResult {
  contributions: CommunityContribution[];
  total: number;
}

export interface ModerationLogResult {
  events: CommunityModerationEvent[];
  total: number;
}

export interface ModerationStats {
  totalComments: number;
  flaggedComments: number;
  pendingReports: number;
  pendingContributions: number;
  hiddenComments: number;
  removedComments: number;
}

// ── Queue Queries ─────────────────────────────────────────────────

export async function listCommentsQueue(filters: CommentsQueueFilters = {}): Promise<CommentsQueueResult> {
  const { status, search, sort = 'newest', limit = 25, offset = 0 } = filters;

  // Build the count query
  let countQuery = supabase.from('community_comments').select('id', { count: 'exact', head: true });
  if (status && status !== 'all') {
    countQuery = countQuery.eq('status', status);
  }
  if (search) {
    countQuery = countQuery.or(`body_plain.ilike.%${search}%,body_markdown.ilike.%${search}%`);
  }
  const { count: total } = await countQuery;

  // Build the data query — join with profiles and threads
  let dataQuery = supabase
    .from('community_comments')
    .select('*, community_threads!inner(title, entity_type, entity_slug, entity_url)')
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') {
    dataQuery = dataQuery.eq('status', status);
  }
  if (search) {
    dataQuery = dataQuery.or(`body_plain.ilike.%${search}%,body_markdown.ilike.%${search}%`);
  }

  switch (sort) {
    case 'most_reported':
      dataQuery = dataQuery.order('report_count', { ascending: false });
      break;
    case 'most_votes':
      dataQuery = dataQuery.order('upvote_count', { ascending: false });
      break;
    case 'oldest':
      dataQuery = dataQuery.order('created_at', { ascending: true });
      break;
    case 'newest':
    default:
      dataQuery = dataQuery.order('created_at', { ascending: false });
      break;
  }

  const { data, error } = await dataQuery;
  if (error) throw error;

  // Hydrate with author profiles
  const authorIds = [...new Set((data || []).map((r: any) => r.author_id))];
  const { data: profiles } = await supabase
    .from('community_profiles')
    .select('*')
    .in('user_id', authorIds);
  const profileMap: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

  const comments: CommunityComment[] = (data || []).map((row: any) => {
    const { community_threads: thread, ...raw } = row;
    return {
      id: raw.id,
      threadId: raw.thread_id,
      parentId: raw.parent_id ?? null,
      rootId: raw.root_id ?? null,
      authorId: raw.author_id,
      author: profileMap[raw.author_id] ? {
        userId: profileMap[raw.author_id].user_id,
        username: profileMap[raw.author_id].username,
        displayName: profileMap[raw.author_id].display_name ?? null,
        avatarUrl: profileMap[raw.author_id].avatar_url ?? null,
        bio: null,
        country: null,
        city: null,
        roleLabels: [],
        trustLevel: 0,
        reputationScore: 0,
        commentCount: 0,
        contributionCount: 0,
        isPublic: true,
        createdAt: '',
        updatedAt: '',
      } : null,
      bodyMarkdown: raw.body_markdown,
      bodyPlain: raw.body_plain ?? null,
      bodyHtml: raw.body_html ?? null,
      depth: raw.depth ?? 0,
      path: raw.path ?? null,
      status: raw.status,
      isPinned: raw.is_pinned ?? false,
      isEditorPick: raw.is_editor_pick ?? false,
      upvoteCount: raw.upvote_count ?? 0,
      downvoteCount: raw.downvote_count ?? 0,
      replyCount: raw.reply_count ?? 0,
      reactionCount: raw.reaction_count ?? 0,
      reportCount: raw.report_count ?? 0,
      score: raw.score ?? 0,
      userVote: null,
      userReactions: [],
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      editedAt: raw.edited_at ?? null,
      deletedAt: raw.deleted_at ?? null,
      threadTitle: thread?.title ?? 'Unknown',
      threadEntityType: thread?.entity_type ?? null,
      threadEntitySlug: thread?.entity_slug ?? null,
    } as CommunityComment & { threadTitle: string; threadEntityType: string | null; threadEntitySlug: string | null };
  });

  return { comments, total: total ?? 0 };
}

export async function listReportsQueue(filters: ReportsQueueFilters = {}): Promise<ReportsQueueResult> {
  const { status, reason, sort = 'newest', limit = 25, offset = 0 } = filters;

  let countQuery = supabase.from('community_reports').select('id', { count: 'exact', head: true });
  if (status) countQuery = countQuery.eq('status', status);
  if (reason) countQuery = countQuery.eq('reason', reason);
  const { count: total } = await countQuery;

  let dataQuery = supabase
    .from('community_reports')
    .select('*')
    .range(offset, offset + limit - 1);

  if (status) dataQuery = dataQuery.eq('status', status);
  if (reason) dataQuery = dataQuery.eq('reason', reason);

  if (sort === 'oldest') {
    dataQuery = dataQuery.order('created_at', { ascending: true });
  } else {
    dataQuery = dataQuery.order('created_at', { ascending: false });
  }

  const { data, error } = await dataQuery;
  if (error) throw error;

  const reports: CommunityReport[] = (data || []).map((row: any) => ({
    id: row.id,
    reporterId: row.reporter_id,
    commentId: row.comment_id ?? null,
    profileId: row.profile_id ?? null,
    reason: row.reason,
    details: row.details ?? null,
    status: row.status,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
  }));

  // Fetch related comments and reporter profiles
  const commentIds = [...new Set(reports.map((r) => r.commentId).filter(Boolean))];
  const reporterIds = [...new Set(reports.map((r) => r.reporterId))];

  if (commentIds.length > 0) {
    const { data: comments } = await supabase
      .from('community_comments')
      .select('id, body_plain, author_id, status, created_at')
      .in('id', commentIds);
    const commentMap: Record<string, any> = {};
    (comments || []).forEach((c: any) => { commentMap[c.id] = c; });
    reports.forEach((r: any) => { r.comment = commentMap[r.commentId] ?? null; });
  }

  return { reports, total: total ?? 0 };
}

export async function listContributionsQueue(
  filters: ContributionsQueueFilters = {}
): Promise<ContributionsQueueResult> {
  const { status, sort = 'newest', limit = 25, offset = 0 } = filters;

  let countQuery = supabase.from('community_contributions').select('id', { count: 'exact', head: true });
  if (status) countQuery = countQuery.eq('status', status);
  const { count: total } = await countQuery;

  let dataQuery = supabase
    .from('community_contributions')
    .select('*')
    .range(offset, offset + limit - 1);

  if (status) dataQuery = dataQuery.eq('status', status);
  if (sort === 'oldest') {
    dataQuery = dataQuery.order('created_at', { ascending: true });
  } else {
    dataQuery = dataQuery.order('created_at', { ascending: false });
  }

  const { data, error } = await dataQuery;
  if (error) throw error;

  const contributions: CommunityContribution[] = (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    sourceCommentId: row.source_comment_id ?? null,
    entityType: row.entity_type,
    entityId: row.entity_id ?? null,
    entitySlug: row.entity_slug ?? null,
    contributionType: row.contribution_type,
    payload: row.payload ?? {},
    status: row.status,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { contributions, total: total ?? 0 };
}

export async function listModerationLog(filters: ModerationLogFilters = {}): Promise<ModerationLogResult> {
  const { action, sort = 'newest', limit = 25, offset = 0 } = filters;

  let countQuery = supabase.from('community_moderation_events').select('id', { count: 'exact', head: true });
  if (action) countQuery = countQuery.eq('action', action);
  const { count: total } = await countQuery;

  let dataQuery = supabase
    .from('community_moderation_events')
    .select('*')
    .range(offset, offset + limit - 1);

  if (action) dataQuery = dataQuery.eq('action', action);
  if (sort === 'oldest') {
    dataQuery = dataQuery.order('created_at', { ascending: true });
  } else {
    dataQuery = dataQuery.order('created_at', { ascending: false });
  }

  const { data, error } = await dataQuery;
  if (error) throw error;

  // Fetch moderator profiles
  const moderatorIds = [...new Set((data || []).map((r: any) => r.moderator_id))];
  const { data: profiles } = await supabase
    .from('community_profiles')
    .select('user_id, username, display_name')
    .in('user_id', moderatorIds);
  const profileMap: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

  const events: CommunityModerationEvent[] = (data || []).map((row: any) => ({
    id: row.id,
    moderatorId: row.moderator_id,
    moderatorName: profileMap[row.moderator_id]?.display_name || profileMap[row.moderator_id]?.username || 'Unknown',
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    reason: row.reason ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  })) as any;

  return { events, total: total ?? 0 };
}

export async function getModerationStats(): Promise<ModerationStats> {
  const [
    { count: totalComments },
    { count: flaggedComments },
    { count: pendingReports },
    { count: pendingContributions },
    { count: hiddenComments },
    { count: removedComments },
  ] = await Promise.all([
    supabase.from('community_comments').select('id', { count: 'exact', head: true }),
    supabase.from('community_comments').select('id', { count: 'exact', head: true }).gt('report_count', 0),
    supabase.from('community_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('community_contributions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('community_comments').select('id', { count: 'exact', head: true }).eq('status', 'hidden'),
    supabase.from('community_comments').select('id', { count: 'exact', head: true }).eq('status', 'removed'),
  ]);

  return {
    totalComments: totalComments ?? 0,
    flaggedComments: flaggedComments ?? 0,
    pendingReports: pendingReports ?? 0,
    pendingContributions: pendingContributions ?? 0,
    hiddenComments: hiddenComments ?? 0,
    removedComments: removedComments ?? 0,
  };
}

// ── Quick Actions ─────────────────────────────────────────────────

async function logModerationEvent(
  targetType: string,
  targetId: string,
  action: string,
  reason?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabase.from('community_moderation_events').insert({
    target_type: targetType,
    target_id: targetId,
    action,
    reason: reason || null,
    metadata: metadata || {},
  });
}

export async function hideComment(commentId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('community_comments')
    .update({ status: 'hidden', updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
  await logModerationEvent('comment', commentId, 'hide', reason);
}

export async function removeComment(commentId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('community_comments')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
  await logModerationEvent('comment', commentId, 'remove', reason);
}

export async function restoreComment(commentId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('community_comments')
    .update({ status: 'visible', updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
  await logModerationEvent('comment', commentId, 'restore', reason);
}

export async function pinComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('community_comments')
    .update({ is_pinned: true, updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
  await logModerationEvent('comment', commentId, 'pin');
}

export async function unpinComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('community_comments')
    .update({ is_pinned: false, updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
  await logModerationEvent('comment', commentId, 'unpin');
}

export async function setEditorPick(commentId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('community_comments')
    .update({ is_editor_pick: value, updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
  await logModerationEvent('comment', commentId, value ? 'editor_pick' : 'remove_editor_pick');
}

export async function lockThread(threadId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('community_threads')
    .update({ status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', threadId);
  if (error) throw error;
  await logModerationEvent('thread', threadId, 'lock', reason);
}

export async function unlockThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('community_threads')
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('id', threadId);
  if (error) throw error;
  await logModerationEvent('thread', threadId, 'unlock');
}

export async function reviewReport(
  reportId: string,
  action: 'resolve' | 'dismiss',
  reason?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';
  const { error } = await supabase
    .from('community_reports')
    .update({
      status: newStatus,
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  if (error) throw error;
  await logModerationEvent('report', reportId, action, reason);
}

export async function reviewContribution(
  contributionId: string,
  action: 'approve' | 'reject',
  reason?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const { error } = await supabase
    .from('community_contributions')
    .update({
      status: newStatus,
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', contributionId);
  if (error) throw error;
  await logModerationEvent('contribution', contributionId, action, reason);
}

export async function mergeContribution(
  contributionId: string,
  reason?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  // Mark as merged and update contributor's reputation
  const { error } = await supabase
    .from('community_contributions')
    .update({
      status: 'merged',
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', contributionId);
  if (error) throw error;

  // Increment contributor's reputation + contribution_count
  const { data: contrib } = await supabase
    .from('community_contributions')
    .select('user_id')
    .eq('id', contributionId)
    .single();

  if (contrib?.user_id) {
    await supabase.rpc('community_increment_reputation', {
      p_user_id: contrib.user_id,
      p_amount: 5,
    });
  }

  await logModerationEvent('contribution', contributionId, 'merge', reason);
}

export async function getCommentById(commentId: string): Promise<CommunityComment | null> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('id', commentId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    threadId: data.thread_id,
    parentId: data.parent_id ?? null,
    rootId: data.root_id ?? null,
    authorId: data.author_id,
    author: null,
    bodyMarkdown: data.body_markdown,
    bodyPlain: data.body_plain ?? null,
    bodyHtml: data.body_html ?? null,
    depth: data.depth ?? 0,
    path: data.path ?? null,
    status: data.status,
    isPinned: data.is_pinned ?? false,
    isEditorPick: data.is_editor_pick ?? false,
    upvoteCount: data.upvote_count ?? 0,
    downvoteCount: data.downvote_count ?? 0,
    replyCount: data.reply_count ?? 0,
    reactionCount: data.reaction_count ?? 0,
    reportCount: data.report_count ?? 0,
    score: data.score ?? 0,
    userVote: null,
    userReactions: [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    editedAt: data.edited_at ?? null,
    deletedAt: data.deleted_at ?? null,
  };
}
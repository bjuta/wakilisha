import { supabase } from '@/lib/supabase';

async function callAdminAnalyticsApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-analytics-api', {
    body: { action, ...payload },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.ok) {
    throw new Error(data?.error?.message ?? 'Admin analytics request failed.');
  }

  return data.data as T;
}

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
  return callAdminAnalyticsApi<CommentsQueueResult>('comments_queue', { filters });
}

export async function listReportsQueue(filters: ReportsQueueFilters = {}): Promise<ReportsQueueResult> {
  return callAdminAnalyticsApi<ReportsQueueResult>('reports_queue', { filters });
}

export async function listContributionsQueue(
  filters: ContributionsQueueFilters = {}
): Promise<ContributionsQueueResult> {
  return callAdminAnalyticsApi<ContributionsQueueResult>('contributions_queue', { filters });
}

export async function listModerationLog(filters: ModerationLogFilters = {}): Promise<ModerationLogResult> {
  return callAdminAnalyticsApi<ModerationLogResult>('moderation_log', { filters });
}

export async function getModerationStats(): Promise<ModerationStats> {
  return callAdminAnalyticsApi<ModerationStats>('moderation_stats');
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
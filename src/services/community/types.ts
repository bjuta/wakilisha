export type CommunityEntityType =
  | 'article'
  | 'magazine_issue'
  | 'briefing_issue'
  | 'artist'
  | 'track'
  | 'release'
  | 'label'
  | 'genre'
  | 'chart'
  | 'chart_edition'
  | 'field_guide'
  | 'profile'
  | 'comment';

export interface CommunityEntity {
  type: CommunityEntityType;
  id?: string;
  slug?: string;
  url: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string | null;
}

export type CommentStatus = 'visible' | 'pending' | 'hidden' | 'deleted' | 'removed' | 'spam';
export type ThreadStatus = 'open' | 'locked' | 'archived' | 'hidden';
export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'merged';
export type ReportReason = 'spam' | 'harassment' | 'hate_or_abuse' | 'misinformation' | 'privacy' | 'copyright' | 'off_topic' | 'other';
export type ReactionType = 'signal' | 'memory' | 'context' | 'fire' | 'agree';
export type SortMode = 'best' | 'newest' | 'oldest' | 'most_replied' | 'editor_picks';
export type CommentAnchorType = 'whole_entity' | 'timestamp' | 'time_range';

export interface CommunityProfile {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  roleLabels: string[];
  trustLevel: number;
  reputationScore: number;
  commentCount: number;
  contributionCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityThread {
  id: string;
  entityType: CommunityEntityType;
  entityId: string | null;
  entitySlug: string | null;
  entityUrl: string | null;
  title: string;
  status: ThreadStatus;
  commentCount: number;
  rootCommentCount: number;
  lastCommentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityComment {
  id: string;
  threadId: string;
  parentId: string | null;
  rootId: string | null;
  authorId: string;
  author: CommunityProfile | null;
  bodyMarkdown: string;
  bodyPlain: string | null;
  bodyHtml: string | null;
  depth: number;
  path: string | null;
  status: CommentStatus;
  isPinned: boolean;
  isEditorPick: boolean;
  upvoteCount: number;
  downvoteCount: number;
  replyCount: number;
  reactionCount: number;
  reportCount: number;
  score: number;
  userVote: number | null;
  userReactions: ReactionType[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  threadTitle?: string | null;
  threadEntityType?: CommunityEntityType | null;
  threadEntityId?: string | null;
  threadEntitySlug?: string | null;
  threadEntityUrl?: string | null;
  anchorType?: CommentAnchorType | null;
  anchorTimeMs?: number | null;
  anchorEndTimeMs?: number | null;
  anchorLabel?: string | null;
  children?: CommunityComment[];
}

export interface CommunityVote {
  id: string;
  userId: string;
  commentId: string;
  voteValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityReaction {
  id: string;
  userId: string;
  targetType: string;
  targetId: string;
  reactionType: ReactionType;
  createdAt: string;
}

export interface CommunityReport {
  id: string;
  reporterId: string;
  commentId: string | null;
  profileId: string | null;
  reason: ReportReason;
  details: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface CommunityModerationEvent {
  id: string;
  moderatorId: string;
  targetType: string;
  targetId: string;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CommunityContribution {
  id: string;
  userId: string;
  sourceCommentId: string | null;
  entityType: CommunityEntityType;
  entityId: string | null;
  entitySlug: string | null;
  contributionType: string;
  payload: Record<string, unknown>;
  status: ContributionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityFollow {
  id: string;
  userId: string;
  targetType: string;
  targetId: string;
  targetSlug: string | null;
  createdAt: string;
}

export interface CommunitySave {
  id: string;
  userId: string;
  entityType: CommunityEntityType;
  entityId: string | null;
  entitySlug: string | null;
  entityUrl: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface CommunityActivity {
  id: string;
  userId: string;
  activityType: string;
  entityType: string | null;
  entityId: string | null;
  entitySlug: string | null;
  entityUrl: string | null;
  entityTitle: string | null;
  commentId: string | null;
  metadata: Record<string, unknown>;
  visibility: string;
  createdAt: string;
}

export interface CommunityNotification {
  id: string;
  userId: string;
  actorId: string | null;
  notificationType: string;
  entityType: string | null;
  entityId: string | null;
  entitySlug: string | null;
  commentId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface CreateCommentInput {
  threadId: string;
  parentId?: string | null;
  bodyMarkdown: string;
  bodyPlain?: string;
  bodyHtml?: string;
  status?: 'visible' | 'pending';
}

export interface CreateTrackMomentCommentInput {
  threadId: string;
  bodyMarkdown: string;
  bodyPlain?: string;
  bodyHtml?: string;
  anchorTimeMs: number;
  anchorEndTimeMs?: number | null;
  anchorLabel?: string | null;
}

export interface TrackMomentSummaryItem {
  anchorTimeMs: number;
  anchorLabel: string;
  commentCount: number;
  reactionCount: number;
  score: number;
  latestCommentAt: string;
}

export interface VoteInput {
  commentId: string;
  voteValue: number;
}

export interface ReactInput {
  targetType: string;
  targetId: string;
  reactionType: ReactionType;
}

export interface ReportInput {
  commentId: string;
  reason: ReportReason;
  details?: string;
}

export interface FollowInput {
  targetType: string;
  targetId: string;
  targetSlug?: string;
}

export interface SaveEntityInput {
  entityType: CommunityEntityType;
  entityId?: string;
  entitySlug?: string;
  entityUrl?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

export interface CreateContributionInput {
  sourceCommentId?: string;
  entityType: CommunityEntityType;
  entityId?: string;
  entitySlug?: string;
  contributionType: string;
  payload?: Record<string, unknown>;
}

export interface CommentSortOptions {
  sortBy?: SortMode;
  limit?: number;
  offset?: number;
  maxDepth?: number;
}

export interface ThreadResult {
  thread: CommunityThread;
  created: boolean;
}

export interface CommentResult {
  comment: CommunityComment;
}

export interface VoteResult {
  voteValue: number;
  existing: number | null;
  delta: number;
}

export interface ReactionResult {
  created: boolean;
  reactionType: ReactionType;
}
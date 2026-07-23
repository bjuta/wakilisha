import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchArticleReviewWorkspace,
  isArticleReviewUnavailable,
  type ArticleDocumentMode,
  type ArticleReviewErrorCode,
  type ArticleReviewTargetVersion,
  type ArticleReviewWorkspace,
} from "@/services/articles/articleReviewService";

export interface UseArticleDocumentModeStateInput {
  articleId: string | null;
  wpStatus: string | null;
  draftVersion: number | null;
}

export interface ArticleDocumentModeState {
  mode: ArticleDocumentMode;
  setMode: (mode: ArticleDocumentMode) => void;
  refresh: () => void;

  reviewWorkspace: ArticleReviewWorkspace | null;
  targetVersion: ArticleReviewTargetVersion | null;

  reviewLoading: boolean;
  reviewUnavailable: boolean;
  reviewErrorCode: ArticleReviewErrorCode | null;
  reviewErrorMessage: string | null;

  canSuggest: boolean;
  canViewSubmitted: boolean;
}

export function useArticleDocumentModeState({
  articleId,
  wpStatus,
  draftVersion,
}: UseArticleDocumentModeStateInput): ArticleDocumentModeState {
  const [mode, setModeState] =
    useState<ArticleDocumentMode>("write");

  const [reviewWorkspace, setReviewWorkspace] =
    useState<ArticleReviewWorkspace | null>(null);

  const [reviewLoading, setReviewLoading] =
    useState(false);

  const [reviewErrorCode, setReviewErrorCode] =
    useState<ArticleReviewErrorCode | null>(null);

  const [reviewErrorMessage, setReviewErrorMessage] =
    useState<string | null>(null);

  const [refreshRevision, setRefreshRevision] =
    useState(0);

  const pendingReview = wpStatus === "pending";

  useEffect(() => {
    let active = true;

    if (!articleId || !pendingReview) {
      setReviewWorkspace(null);
      setReviewLoading(false);
      setReviewErrorCode(null);
      setReviewErrorMessage(null);
      setModeState("write");

      return () => {
        active = false;
      };
    }

    setReviewLoading(true);
    setReviewErrorCode(null);
    setReviewErrorMessage(null);

    void (async () => {
      const result = await fetchArticleReviewWorkspace(
        articleId,
      );

      if (!active) return;

      if (!result.ok) {
        setReviewWorkspace(null);
        setReviewLoading(false);
        setReviewErrorCode(result.errorCode);
        setReviewErrorMessage(result.error);
        setModeState("write");
        return;
      }

      setReviewWorkspace(result.data);
      setReviewLoading(false);

      if (!result.data.targetVersion) {
        setModeState("write");
      }
    })();

    return () => {
      active = false;
    };
  }, [
    articleId,
    draftVersion,
    pendingReview,
    refreshRevision,
  ]);

  const targetVersion =
    reviewWorkspace?.targetVersion ?? null;

  const canSuggest = Boolean(
    pendingReview && targetVersion,
  );

  const canViewSubmitted = Boolean(
    pendingReview && targetVersion,
  );

  const setMode = useCallback(
    (nextMode: ArticleDocumentMode) => {
      if (nextMode === "write") {
        setModeState("write");
        return;
      }

      if (!targetVersion) {
        setModeState("write");
        return;
      }

      if (
        nextMode === "suggest" &&
        !canSuggest
      ) {
        setModeState("write");
        return;
      }

      if (
        nextMode === "view" &&
        !canViewSubmitted
      ) {
        setModeState("write");
        return;
      }

      setModeState(nextMode);
    },
    [
      canSuggest,
      canViewSubmitted,
      targetVersion,
    ],
  );

  const refresh = useCallback(() => {
    setRefreshRevision(
      (currentRevision) => currentRevision + 1,
    );
  }, []);

  const reviewUnavailable = useMemo(
    () =>
      reviewErrorCode === "unavailable" ||
      (
        reviewErrorCode !== null &&
        isArticleReviewUnavailable({
          ok: false,
          error: reviewErrorMessage || "",
          errorCode: reviewErrorCode,
        })
      ),
    [
      reviewErrorCode,
      reviewErrorMessage,
    ],
  );

  return {
    mode,
    setMode,
    refresh,

    reviewWorkspace,
    targetVersion,

    reviewLoading,
    reviewUnavailable,
    reviewErrorCode,
    reviewErrorMessage,

    canSuggest,
    canViewSubmitted,
  };
}

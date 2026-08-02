import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ArticleTrustServiceError,
  fetchArticleVersionTrustWorkspace,
  fetchArticleWorkingVersionIdentity,
  type ArticleTrustErrorKind,
  type ArticleTrustWorkspace,
  type ArticleWorkingVersionIdentity,
} from "@/services/articles/articleTrustService";

export interface ArticleTrustWorkspaceState {
  identity: ArticleWorkingVersionIdentity | null;
  workspace: ArticleTrustWorkspace | null;
  publishedWorkspace: ArticleTrustWorkspace | null;
  loading: boolean;
  errorMessage: string | null;
  errorKind: ArticleTrustErrorKind | null;
  refresh: () => void;
}

export interface UseArticleTrustWorkspaceInput {
  articleId: string | null;
  draftVersion: number | null;
  enabled: boolean;
}

export function useArticleTrustWorkspace({
  articleId,
  draftVersion,
  enabled,
}: UseArticleTrustWorkspaceInput): ArticleTrustWorkspaceState {
  const [identity, setIdentity] =
    useState<ArticleWorkingVersionIdentity | null>(null);
  const [workspace, setWorkspace] =
    useState<ArticleTrustWorkspace | null>(null);
  const [publishedWorkspace, setPublishedWorkspace] =
    useState<ArticleTrustWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [errorKind, setErrorKind] =
    useState<ArticleTrustErrorKind | null>(null);
  const [refreshRevision, setRefreshRevision] =
    useState(0);

  useEffect(() => {
    let active = true;

    if (!enabled || !articleId) {
      setIdentity(null);
      setWorkspace(null);
      setPublishedWorkspace(null);
      setLoading(false);
      setErrorMessage(null);
      setErrorKind(null);

      return () => {
        active = false;
      };
    }

    setLoading(true);
    setErrorMessage(null);
    setErrorKind(null);

    void (async () => {
      try {
        const nextIdentity =
          await fetchArticleWorkingVersionIdentity(
            articleId,
          );

        const nextWorkspacePromise =
          fetchArticleVersionTrustWorkspace(
            nextIdentity.workingVersionId,
          );

        const nextPublishedWorkspacePromise =
          nextIdentity.publishedVersionId &&
          nextIdentity.publishedVersionId !==
            nextIdentity.workingVersionId
            ? fetchArticleVersionTrustWorkspace(
                nextIdentity.publishedVersionId,
              )
            : Promise.resolve(null);

        const [
          nextWorkspace,
          nextPublishedWorkspace,
        ] = await Promise.all([
          nextWorkspacePromise,
          nextPublishedWorkspacePromise,
        ]);

        const confirmedIdentity =
          await fetchArticleWorkingVersionIdentity(
            articleId,
          );

        if (
          confirmedIdentity.workingVersionId !==
            nextIdentity.workingVersionId ||
          confirmedIdentity.publishedVersionId !==
            nextIdentity.publishedVersionId
        ) {
          throw new ArticleTrustServiceError(
            "Article working version changed while trust was loading",
            "concurrency",
          );
        }

        if (!active) return;

        setIdentity(confirmedIdentity);
        setWorkspace(nextWorkspace);
        setPublishedWorkspace(
          nextPublishedWorkspace,
        );
        setLoading(false);
      } catch (error) {
        if (!active) return;

        setIdentity(null);
        setWorkspace(null);
        setPublishedWorkspace(null);
        setLoading(false);

        if (error instanceof ArticleTrustServiceError) {
          setErrorMessage(error.message);
          setErrorKind(error.kind);
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Article trust could not be loaded.",
        );
        setErrorKind("unknown");
      }
    })();

    return () => {
      active = false;
    };
  }, [
    articleId,
    draftVersion,
    enabled,
    refreshRevision,
  ]);

  const refresh = useCallback(() => {
    setRefreshRevision(
      (currentRevision) => currentRevision + 1,
    );
  }, []);

  return {
    identity,
    workspace,
    publishedWorkspace,
    loading,
    errorMessage,
    errorKind,
    refresh,
  };
}

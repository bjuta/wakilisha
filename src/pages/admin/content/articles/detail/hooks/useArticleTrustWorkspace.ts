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

        const nextWorkspace =
          await fetchArticleVersionTrustWorkspace(
            nextIdentity.workingVersionId,
          );

        if (!active) return;

        setIdentity(nextIdentity);
        setWorkspace(nextWorkspace);
        setLoading(false);
      } catch (error) {
        if (!active) return;

        setIdentity(null);
        setWorkspace(null);
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
    loading,
    errorMessage,
    errorKind,
    refresh,
  };
}

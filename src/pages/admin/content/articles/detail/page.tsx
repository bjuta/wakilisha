import { useParams } from "react-router-dom";
import { ArticleEditorWorkspace } from "./ArticleEditorWorkspace";

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  return <ArticleEditorWorkspace slug={slug} mode="article-admin" />;
}

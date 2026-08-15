import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import { PostDetailSurface } from "@/components/community/PostDetailSurface";
import { getPost, type CommunityPost } from "@/services/community/posts";

const PUBLIC_ORIGIN = "https://wakilisha.africa";

export default function PostDetailPage() {
  const { slug, postId } = useParams<{ slug: string; postId: string }>();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!postId) {
      setError("Post was not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getPost(postId)
      .then((nextPost) => {
        if (cancelled) return;
        if (nextPost.actor.type !== "person" || nextPost.actor.slug !== slug) {
          setError("Post was not found.");
          setPost(null);
          return;
        }
        setPost(nextPost);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Post was not found.");
          setPost(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [postId, slug]);

  if (loading) {
    return <main className="wk-container px-6 py-14"><div className="mx-auto h-64 max-w-2xl animate-pulse rounded-3xl bg-[var(--wk-surface-raised)]" /></main>;
  }

  if (!post || error) {
    return (
      <main className="wk-container px-6 py-16 text-center">
        <MetaTags title="Post" robots="noindex,nofollow" />
        <h1 className="text-[28px] font-black">Post Not Found</h1>
        <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">{error || "This Post is unavailable."}</p>
        {slug && <Link to={`/people/${slug}`} className="mt-6 inline-block text-[12px] font-black text-[var(--wk-brand)] hover:underline">Back to Profile</Link>}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <MetaTags
        title={`Post from ${post.actor.name}`}
        description={post.body}
        canonicalUrl={new URL(post.canonicalPath, PUBLIC_ORIGIN).toString()}
      />
      <PostDetailSurface post={post} />
    </main>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import { PostDetailSurface } from "@/components/community/PostDetailSurface";
import { getPost, type CommunityPost } from "@/services/community/posts";

const PUBLIC_ORIGIN = "https://wakilisha.africa";

export default function ArtistUpdatePage() {
  const { slug, updateId } = useParams<{ slug: string; updateId: string }>();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug || !updateId) {
      setError("Post was not found.");
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    setError(null);
    getPost(updateId)
      .then((nextPost) => {
        if (!alive) return;
        if (nextPost.actor.type !== "artist" || nextPost.actor.slug !== slug) {
          setError("Post was not found.");
          setPost(null);
          return;
        }
        setPost(nextPost);
      })
      .catch((nextError) => {
        if (!alive) return;
        setError(nextError instanceof Error ? nextError.message : "Post was not found.");
        setPost(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [slug, updateId]);

  if (loading) {
    return <main className="wk-container px-6 py-20"><p className="text-[14px] text-[var(--wk-text-muted)]">Loading Post...</p></main>;
  }

  if (!post || error) {
    return (
      <main className="wk-container px-6 py-20">
        <MetaTags title="Post" robots="noindex,nofollow" />
        <h1 className="text-[28px] font-black text-[var(--wk-text)]">Post Not Found</h1>
        <p className="mt-2 text-[14px] text-[var(--wk-text-muted)]">This Post may have been deleted or is no longer available.</p>
        {slug && <Link to={`/artists/${slug}`} className="mt-6 inline-block text-[12px] font-black text-[var(--wk-brand)] hover:underline">Back to Artist</Link>}
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

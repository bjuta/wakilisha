import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import {
  ShareSheet,
  type ShareObject,
} from "@/components/design-system/share/ShareSheet";
import { getPost, type CommunityPost } from "@/services/community/posts";

const PUBLIC_ORIGIN = "https://wakilisha.africa";

export default function PostDetailPage() {
  const { slug, postId } = useParams<{ slug: string; postId: string }>();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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
        if (nextPost.actor.type !== "person") {
          setError("Post was not found.");
          return;
        }
        setPost(nextPost);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Post was not found.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [postId]);

  const shareItem = useMemo<ShareObject | null>(
    () => post ? {
      title: `Post from ${post.actor.name}`,
      subtitle: post.actor.name,
      description: post.body,
      imageUrl: post.imageUrl,
      url: new URL(post.canonicalPath, PUBLIC_ORIGIN).toString(),
      type: "post",
    } : null,
    [post],
  );

  if (loading) {
    return (
      <main className="wk-container px-6 py-14">
        <div className="mx-auto h-64 max-w-2xl animate-pulse rounded-3xl bg-[var(--wk-surface-raised)]" />
      </main>
    );
  }

  if (!post || error) {
    return (
      <main className="wk-container px-6 py-16 text-center">
        <h1 className="text-[28px] font-black">Post Not Found</h1>
        <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">
          {error || "This Post is unavailable."}
        </p>
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

      <article className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-0 md:py-12">
        {slug !== post.actor.slug && (
          <Link
            to={post.canonicalPath}
            className="mb-5 inline-block text-[11px] font-black text-[var(--wk-brand)] hover:underline"
          >
            View canonical Post
          </Link>
        )}

        <div className="flex items-center gap-3">
          <Link to={post.actor.canonicalPath} className="shrink-0">
            {post.actor.imageUrl ? (
              <img src={post.actor.imageUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[13px] font-black text-[var(--wk-brand)]">
                {post.actor.name[0]?.toUpperCase() || "W"}
              </div>
            )}
          </Link>
          <div>
            <Link
              to={post.actor.canonicalPath}
              className="text-[15px] font-black hover:text-[var(--wk-brand)]"
            >
              {post.actor.name}
            </Link>
            <div className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
              @{post.actor.slug}
            </div>
          </div>
        </div>

        {post.imageUrl && (
          <div className="mt-5 overflow-hidden rounded-[28px] bg-[var(--wk-surface-raised)]">
            <img src={post.imageUrl} alt="" className="aspect-[16/10] w-full object-cover" />
          </div>
        )}

        <p className="mt-5 whitespace-pre-wrap text-[21px] font-semibold leading-[1.55] tracking-[-0.015em] md:text-[25px]">
          {post.body}
        </p>

        {post.linkUrl && (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 py-2.5 text-[12px] font-black hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
          >
            {post.linkLabel || "Open Link"}
            <i className="ri-external-link-line" aria-hidden="true" />
          </a>
        )}

        <div className="mt-6 border-t border-[var(--wk-divider)] pt-3">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[12px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
          >
            <i className="ri-share-forward-line text-[17px]" aria-hidden="true" />
            Share
          </button>
        </div>
      </article>

      {shareItem && (
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          item={shareItem}
        />
      )}
    </main>
  );
}

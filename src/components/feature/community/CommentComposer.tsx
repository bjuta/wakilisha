import { useState, useRef, useCallback } from "react";
import type { AuthUser } from "@/hooks/useAuthUser";

interface CommentComposerProps {
  user: AuthUser;
  onSubmit: (body: string) => Promise<unknown>;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export function CommentComposer({
  user,
  onSubmit,
  placeholder = "Join the conversation...",
  autoFocus = false,
  compact = false,
}: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post. Try again.");
    } finally {
      setPosting(false);
    }
  }, [body, posting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[var(--wk-surface-strong)] flex items-center justify-center overflow-hidden shrink-0 mt-1">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <i className="ri-user-line text-[14px] text-[var(--wk-text-faint)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={`${placeholder} Maximum 2000 characters.`}
          rows={compact ? 2 : 3}
          maxLength={2000}
          autoFocus={autoFocus}
          className="w-full bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-xl px-4 py-3 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] resize-none focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
        />
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          {compact ? (
            body.length >= 1800 ? (
              <span
                className={
                  body.length >= 1950
                    ? "text-[11px] font-semibold text-[var(--wk-danger)]"
                    : "text-[11px] text-[var(--wk-text-faint)]"
                }
              >
                {body.length}/2000
              </span>
            ) : null
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--wk-text-faint)]">
                {body.length}/2000
              </span>
              <span className="text-[10px] text-[var(--wk-text-faint)] hidden sm:inline">
                <kbd className="px-1 py-0.5 rounded bg-[var(--wk-surface-strong)] text-[10px] font-mono">⌘</kbd>+<kbd className="px-1 py-0.5 rounded bg-[var(--wk-surface-strong)] text-[10px] font-mono">Enter</kbd> to post
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {!compact && (
              <span className="text-[12px] font-medium text-[var(--wk-text-soft)] hidden sm:inline">
                {user.name || user.email?.split("@")[0] || "You"}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={!body.trim() || posting}
              className="h-9 px-5 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[12px] font-bold cursor-pointer whitespace-nowrap transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-[12px] text-[var(--wk-danger)]">{error}</p>
        )}
      </div>
    </div>
  );
}

export function LoginToComment({
  onSignIn,
  compact = false,
}: {
  onSignIn?: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 text-[12px] font-bold text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
      >
        <i className="ri-login-box-line" aria-hidden="true" />
        Sign In to Reply
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] flex-wrap">
      <div className="w-9 h-9 rounded-full bg-[var(--wk-surface-strong)] flex items-center justify-center shrink-0">
        <i className="ri-chat-1-line text-[16px] text-[var(--wk-text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--wk-text)]">Want to join the conversation?</p>
        <p className="text-[12px] text-[var(--wk-text-muted)]">Sign in to share your thoughts and connect with the community.</p>
      </div>
      <button
        onClick={onSignIn}
        className="h-9 px-5 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[12px] font-bold hover:opacity-90 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
      >
        Sign In
      </button>
    </div>
  );
}
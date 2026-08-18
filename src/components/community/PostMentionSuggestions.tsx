import type {
  PostMentionSuggestion,
} from "@/services/community/mentionSuggestions";

export function PostMentionSuggestions({
  query,
  suggestions,
  loading,
  activeIndex,
  onSelect,
}: {
  query: string;
  suggestions: readonly PostMentionSuggestion[];
  loading: boolean;
  activeIndex: number;
  onSelect: (suggestion: PostMentionSuggestion) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label="People to mention"
      className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[240px] overflow-y-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1.5 shadow-xl"
    >
      {loading && suggestions.length === 0 ? (
        <div className="px-3 py-3 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          Finding people...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-3 py-3 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          No username matches @{query}.
        </div>
      ) : (
        suggestions.map((suggestion, index) => (
          <button
            key={suggestion.personId}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(suggestion)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
              index === activeIndex
                ? "bg-[var(--wk-brand-soft)]"
                : "hover:bg-[var(--wk-bg)]"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
              {suggestion.avatarUrl ? (
                <img
                  src={suggestion.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <i
                  className="ri-user-line text-[15px] text-[var(--wk-text-muted)]"
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-black text-[var(--wk-text)]">
                {suggestion.displayName}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
                @{suggestion.handle}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

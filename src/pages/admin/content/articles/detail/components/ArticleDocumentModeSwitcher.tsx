import type {
  ArticleDocumentMode,
  ArticleReviewErrorCode,
} from "@/services/articles/articleReviewService";

interface Props {
  mode: ArticleDocumentMode;
  onModeChange: (mode: ArticleDocumentMode) => void;

  canSuggest: boolean;
  canViewSubmitted: boolean;

  loading: boolean;
  errorCode: ArticleReviewErrorCode | null;

  targetVersionNumber: number | null;

  suggestionCount: number;
  onOpenSuggestions: () => void;
}

const MODES: Array<{
  key: ArticleDocumentMode;
  label: string;
  description: string;
}> = [
  {
    key: "write",
    label: "Write",
    description: "Edit the current working draft.",
  },
  {
    key: "suggest",
    label: "Suggest",
    description:
      "Select text in the submitted version and prepare a proposed change.",
  },
  {
    key: "view",
    label: "View",
    description:
      "Read the immutable submitted version without changing it.",
  },
];

function reviewErrorLabel(
  errorCode: ArticleReviewErrorCode | null,
): string | null {
  if (!errorCode) return null;

  if (errorCode === "unavailable") {
    return "Review authority is not available yet.";
  }

  if (errorCode === "permission_denied") {
    return "You do not have access to this submitted version.";
  }

  return "The submitted review version could not be loaded.";
}

export function ArticleDocumentModeSwitcher({
  mode,
  onModeChange,
  canSuggest,
  canViewSubmitted,
  loading,
  errorCode,
  targetVersionNumber,
  suggestionCount,
  onOpenSuggestions,
}: Props) {
  const errorLabel = reviewErrorLabel(errorCode);

  return (
    <section
      aria-label="Article document mode"
      data-article-document-mode={mode}
      className="rounded-xl border border-wk-border bg-wk-surface px-3 py-3 sm:px-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
            Document Mode
          </div>

          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
            {mode === "write"
              ? "Working draft"
              : targetVersionNumber
                ? `Submitted version ${targetVersionNumber}`
                : "Submitted version"}
          </p>
        </div>

        <div
          role="group"
          aria-label="Choose document mode"
          className="grid grid-cols-3 gap-1 rounded-lg bg-wk-bg-subtle p-1"
        >
          {MODES.map((definition) => {
            const active = definition.key === mode;

            const disabled =
              loading ||
              (
                definition.key === "suggest" &&
                !canSuggest
              ) ||
              (
                definition.key === "view" &&
                !canViewSubmitted
              );

            return (
              <button
                key={definition.key}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                title={definition.description}
                onClick={() =>
                  onModeChange(definition.key)
                }
                className={`rounded-md px-3 py-2 text-[11px] font-bold transition-colors ${
                  active
                    ? "bg-wk-brand text-wk-brand-on shadow-sm"
                    : "text-wk-text-muted hover:bg-wk-surface hover:text-wk-text disabled:cursor-not-allowed disabled:opacity-40"
                }`}
              >
                {definition.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-wk-border pt-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
            Review Suggestions
          </div>

          <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
            Saved proposals against this submitted
            version.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSuggestions}
          disabled={loading || suggestionCount === 0}
          className="wk-button wk-button-secondary wk-button-sm shrink-0"
        >
          Suggestions
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-black text-wk-text">
            {suggestionCount}
          </span>
        </button>
      </div>

      {loading ? (
        <p
          aria-live="polite"
          className="mt-2 text-[10px] font-semibold text-wk-text-faint"
        >
          Loading submitted version…
        </p>
      ) : errorLabel ? (
        <p
          role="status"
          className="mt-2 text-[10px] font-semibold text-wk-warning"
        >
          {errorLabel}
        </p>
      ) : null}
    </section>
  );
}

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import { ReleaseShellIntakeDrawer } from "@/components/admin/registry/release-shells/ReleaseShellIntakeDrawer";
import {
  formatConfidence,
  getLiveReleaseShellReviewRows,
  updateReleaseShellSuggestionDecision,
  updateReleaseShellLifecycleStatus,
  previewApprovedReleaseShellSuggestions,
  applyApprovedReleaseShellSuggestions,
  getReleaseShellCanonicalWriteAuditEvents,
  type EnrichmentDecisionStatus,
  type RegistryEnrichmentSuggestionReviewItem,
  type RegistryReleaseShellReviewRow,
  type ReleaseShellEnrichmentContext,
  type CanonicalWriteAuditEvent,
  type ApplyApprovedReleaseShellSuggestionsPreview,
} from "@/services/registry/enrichment-review/client";

// ── State machine types ──────────────────────────────────────────────────────
// Per the product brief: Open → Needs Review → Ready to Apply → Partially Applied
//                        → Failed Write → Resolved → Reopened
type ShellStatus =
  | "open"
  | "needs_review"
  | "ready_to_apply"
  | "partially_applied"
  | "failed_write"
  | "resolved"
  | "reopened";

type QueueFilter = "active" | "all" | ShellStatus;
type SuggestionLaneKey = "pending" | "needsReview" | "approved" | "rejected" | "applied" | "other";
type LocalSuggestionDecision = Extract<EnrichmentDecisionStatus, "approved" | "rejected" | "needs_review">;

// ── Status computation ────────────────────────────────────────────────────────

function computeShellStatus(
  context: ReleaseShellEnrichmentContext | undefined,
  auditEvents: CanonicalWriteAuditEvent[],
  overrides: Record<string, EnrichmentDecisionStatus>,
): ShellStatus {
  if (context?.lifecycle?.status === "resolved") return "resolved";
  if (context?.lifecycle?.status === "reopened") return "reopened";
  if (auditEvents.some((e) => e.status === "failed")) return "failed_write";

  const suggestions = context?.suggestions ?? [];
  const groups = groupSuggestions(suggestions, overrides);

  if (groups.pending.length === 0 && groups.needsReview.length === 0 && groups.applied.length > 0 && groups.approved.length > 0) {
    return "partially_applied";
  }

  if (groups.needsReview.length > 0) return "needs_review";

  if (groups.pending.length === 0 && groups.needsReview.length === 0 && groups.approved.length > 0) {
    return "ready_to_apply";
  }

  return "open";
}

function groupSuggestions(
  suggestions: RegistryEnrichmentSuggestionReviewItem[],
  overrides: Record<string, EnrichmentDecisionStatus>,
): Record<SuggestionLaneKey, RegistryEnrichmentSuggestionReviewItem[]> {
  return suggestions.reduce<Record<SuggestionLaneKey, RegistryEnrichmentSuggestionReviewItem[]>>(
    (groups, s) => {
      const status = overrides[s.id] ?? s.decisionStatus;
      if (status === "draft") groups.pending.push(s);
      else if (status === "needs_review") groups.needsReview.push(s);
      else if (status === "approved") groups.approved.push(s);
      else if (status === "rejected") groups.rejected.push(s);
      else if (status === "applied") groups.applied.push(s);
      else groups.other.push(s);
      return groups;
    },
    { pending: [], needsReview: [], approved: [], rejected: [], applied: [], other: [] },
  );
}

// ── Status badge styling ──────────────────────────────────────────────────────

function shellStatusStyle(status: ShellStatus): { badge: string; dot: string; label: string } {
  switch (status) {
    case "open": return { badge: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]", dot: "bg-[var(--wk-brand)]", label: "Open" };
    case "needs_review": return { badge: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]", dot: "bg-[var(--wk-warning)]", label: "Needs Review" };
    case "ready_to_apply": return { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", label: "Ready to Apply" };
    case "partially_applied": return { badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500", label: "Partially Applied" };
    case "failed_write": return { badge: "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]", dot: "bg-[var(--wk-danger)]", label: "Failed Write" };
    case "resolved": return { badge: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]", dot: "bg-[var(--wk-success)]", label: "Resolved" };
    case "reopened": return { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", label: "Reopened" };
  }
}

function suggestionStatusClass(status: EnrichmentDecisionStatus): string {
  if (status === "approved") return "bg-[var(--wk-success-soft)] text-[var(--wk-success)]";
  if (status === "rejected") return "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]";
  if (status === "needs_review") return "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]";
  if (status === "applied") return "bg-[var(--wk-success-soft)] text-[var(--wk-success)]";
  return "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]";
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ");
}

// ── Apply confirmation modal ──────────────────────────────────────────────────

interface ConfirmApplyModalProps {
  preview: ApplyApprovedReleaseShellSuggestionsPreview;
  applying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmApplyModal({ preview, applying, onConfirm, onCancel }: ConfirmApplyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl">
        <div className="border-b border-[var(--wk-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">
              <WkIcon name="ShieldAlert" size={18} />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-[var(--wk-text)]">Confirm canonical apply</h2>
              <p className="text-[12px] text-[var(--wk-text-muted)]">This action will be audited and cannot be undone.</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">
            {preview.willCreateCanonicalRelease
              ? "You are about to create a new canonical registry release and apply the fields below."
              : "You are about to update an existing canonical registry release with the fields below."}
          </p>

          <div className="space-y-2 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">
              {preview.writable.length} field(s) will write
            </p>
            <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 space-y-2">
              {preview.writable.map((item) => (
                <div key={item.suggestionId} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-[var(--wk-text)]">{item.fieldName}</span>
                    <WkIcon name="ArrowRight" size={12} className="text-[var(--wk-text-faint)]" />
                    <span className="text-[12px] text-[var(--wk-success)] font-semibold truncate max-w-[200px]">{item.proposedValue}</span>
                  </div>
                  {item.currentValue && (
                    <p className="text-[10px] text-[var(--wk-text-faint)] pl-0">
                      Currently: {item.currentValue}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {preview.skipped.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-warning)] mb-2">
                {preview.skipped.length} field(s) will be skipped
              </p>
              <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 space-y-1">
                {preview.skipped.map((item) => (
                  <p key={item.suggestionId} className="text-[11px] text-[var(--wk-text-muted)]">
                    {item.fieldName}: {item.reason ?? "Not writable"}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-[var(--wk-brand-soft)] bg-[var(--wk-brand-soft)] p-3">
            <p className="text-[12px] font-semibold text-[var(--wk-brand)]">
              All writes are audited. Every applied field creates a canonical write event linked to your account.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--wk-border)] px-5 py-4">
          <button
            onClick={onCancel}
            disabled={applying}
            className="wk-button wk-button-ghost wk-button-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={applying}
            className="wk-button wk-button-primary wk-button-sm disabled:opacity-50 flex items-center gap-2"
          >
            {applying ? (
              <>
                <WkIcon name="Loader" size={14} className="animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <WkIcon name="CheckCheck" size={14} />
                Confirm apply ({preview.writable.length} field{preview.writable.length !== 1 ? "s" : ""})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Suggestion card ───────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: RegistryEnrichmentSuggestionReviewItem;
  overrides: Record<string, EnrichmentDecisionStatus>;
  saving: boolean;
  readOnly: boolean;
  allowNeedsReview: boolean;
  onDecide: (suggestion: RegistryEnrichmentSuggestionReviewItem, decision: LocalSuggestionDecision) => void;
}

function SuggestionCard({ suggestion, overrides, saving, readOnly, allowNeedsReview, onDecide }: SuggestionCardProps) {
  const status = overrides[suggestion.id] ?? suggestion.decisionStatus;
  const isApplied = status === "applied";

  return (
    <div className={`rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3.5 ${isApplied ? "opacity-75" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-bold text-[var(--wk-text)]">{suggestion.fieldName}</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${suggestionStatusClass(status)}`}>
              {formatStatus(status)}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--wk-text-faint)] mb-0.5">Suggested</p>
              <p className="text-[12px] font-semibold text-[var(--wk-text)] break-words">{suggestion.suggestedValue}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--wk-text-faint)] mb-0.5">Current</p>
              <p className="text-[12px] text-[var(--wk-text-muted)] break-words">{suggestion.currentValue ?? "empty"}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--wk-text-faint)]">
            Confidence: {formatConfidence(suggestion.confidenceScore)}
            {suggestion.providerItemId && <> · Provider: {suggestion.providerItemId}</>}
          </p>
        </div>

        {!readOnly && !isApplied && (
          <div className="flex shrink-0 flex-wrap gap-1">
            {status !== "approved" && (
              <button
                onClick={() => onDecide(suggestion, "approved")}
                disabled={saving}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
              >
                Approve
              </button>
            )}
            {status === "approved" && (
              <button
                onClick={() => onDecide(suggestion, "rejected")}
                disabled={saving}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:opacity-50 whitespace-nowrap"
              >
                Undo approve
              </button>
            )}
            {allowNeedsReview && status !== "needs_review" && (
              <button
                onClick={() => onDecide(suggestion, "needs_review")}
                disabled={saving}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--wk-warning)] hover:bg-[var(--wk-warning-soft)] disabled:opacity-50 whitespace-nowrap"
              >
                Flag
              </button>
            )}
            {status !== "rejected" && status !== "approved" && (
              <button
                onClick={() => onDecide(suggestion, "rejected")}
                disabled={saving}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] disabled:opacity-50 whitespace-nowrap"
              >
                Reject
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shell expanded panel ──────────────────────────────────────────────────────

interface ShellPanelProps {
  row: RegistryReleaseShellReviewRow;
  context: ReleaseShellEnrichmentContext | undefined;
  auditEvents: CanonicalWriteAuditEvent[];
  overrides: Record<string, EnrichmentDecisionStatus>;
  savingIds: Record<string, boolean>;
  applyPreview: ApplyApprovedReleaseShellSuggestionsPreview | undefined;
  previewLoading: boolean;
  applyLoading: boolean;
  lifecycleLoading: boolean;
  onDecide: (s: RegistryEnrichmentSuggestionReviewItem, d: LocalSuggestionDecision) => void;
  onPreview: () => void;
  onCancelPreview: () => void;
  onApply: () => void;
  onLifecycle: (status: "resolved" | "reopened") => void;
  showConfirmModal: boolean;
}

function ShellPanel({
  row,
  context,
  auditEvents,
  overrides,
  savingIds,
  applyPreview,
  previewLoading,
  applyLoading,
  lifecycleLoading,
  onDecide,
  onPreview,
  onCancelPreview,
  onApply,
  onLifecycle,
  showConfirmModal,
}: ShellPanelProps) {
  const suggestions = context?.suggestions ?? [];
  const groups = groupSuggestions(suggestions, overrides);
  const shellStatus = computeShellStatus(context, auditEvents, overrides);
  const lifecycleStatus = context?.lifecycle?.status ?? "open";
  const noLiveContext = context?.dataSource !== "runtime_api";

  const appliedOrSkippedCount = auditEvents.filter((e) => e.status === "applied" || e.status === "skipped").length;
  const canResolve =
    lifecycleStatus !== "resolved" &&
    suggestions.length > 0 &&
    groups.pending.length === 0 &&
    groups.needsReview.length === 0 &&
    appliedOrSkippedCount > 0;

  if (noLiveContext) {
    return (
      <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-8 text-center">
        <WkIcon name="CloudOff" size={28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="text-[14px] font-bold text-[var(--wk-text)]">No live staging context found for this shell.</p>
        <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
          Run provider enrichment staging to generate field suggestions for this release.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      {/* Suggestions column */}
      <div className="space-y-4">
        {/* Pending */}
        {groups.pending.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">
                Pending · {groups.pending.length}
              </p>
            </div>
            <div className="space-y-2">
              {groups.pending.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  overrides={overrides}
                  saving={Boolean(savingIds[s.id])}
                  readOnly={false}
                  allowNeedsReview
                  onDecide={onDecide}
                />
              ))}
            </div>
          </div>
        )}

        {/* Needs review */}
        {groups.needsReview.length > 0 && (
          <div className="rounded-xl border border-[var(--wk-warning-soft)] bg-[var(--wk-warning-soft)]/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <WkIcon name="AlertCircle" size={14} className="text-[var(--wk-warning)]" />
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-warning)]">
                Needs Review · {groups.needsReview.length}
              </p>
            </div>
            <div className="space-y-2">
              {groups.needsReview.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  overrides={overrides}
                  saving={Boolean(savingIds[s.id])}
                  readOnly={false}
                  allowNeedsReview={false}
                  onDecide={onDecide}
                />
              ))}
            </div>
          </div>
        )}

        {/* Approved (editable until applied) */}
        {groups.approved.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                Approved · {groups.approved.length}
              </p>
              <span className="text-[10px] text-[var(--wk-text-faint)]">Can be changed before apply</span>
            </div>
            <div className="space-y-2">
              {groups.approved.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  overrides={overrides}
                  saving={Boolean(savingIds[s.id])}
                  readOnly={false}
                  allowNeedsReview
                  onDecide={onDecide}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rejected */}
        {groups.rejected.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--wk-danger)]">
              Rejected · {groups.rejected.length}
            </p>
            <div className="space-y-2 opacity-70">
              {groups.rejected.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  overrides={overrides}
                  saving={Boolean(savingIds[s.id])}
                  readOnly
                  allowNeedsReview={false}
                  onDecide={onDecide}
                />
              ))}
            </div>
          </div>
        )}

        {/* Applied */}
        {groups.applied.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--wk-success)]">
              Applied · {groups.applied.length}
            </p>
            <div className="space-y-2">
              {groups.applied.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  overrides={overrides}
                  saving={false}
                  readOnly
                  allowNeedsReview={false}
                  onDecide={onDecide}
                />
              ))}
            </div>
          </div>
        )}

        {suggestions.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--wk-border)] px-4 py-8 text-center">
            <p className="text-[13px] text-[var(--wk-text-muted)]">No enrichment suggestions for this shell.</p>
          </div>
        )}
      </div>

      {/* Context + actions column */}
      <div className="space-y-4">
        {/* Shell actions */}
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Shell actions</p>

          <div className="space-y-2">
            <button
              onClick={onPreview}
              disabled={
                lifecycleStatus === "resolved" ||
                groups.approved.length === 0 ||
                previewLoading ||
                applyLoading
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-brand-soft)] py-2.5 text-[13px] font-bold text-[var(--wk-brand)] hover:bg-[var(--wk-brand)] hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {previewLoading ? (
                <><WkIcon name="Loader" size={14} className="animate-spin" /> Generating preview…</>
              ) : (
                <><WkIcon name="Eye" size={14} /> Preview apply ({groups.approved.length} approved)</>
              )}
            </button>

            {groups.approved.length === 0 && suggestions.length > 0 && lifecycleStatus !== "resolved" && (
              <p className="text-[11px] text-[var(--wk-text-faint)] text-center">
                Approve at least one suggestion to enable preview &amp; apply.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onLifecycle("resolved")}
                disabled={lifecycleStatus === "resolved" || !canResolve || lifecycleLoading}
                title={!canResolve && lifecycleStatus !== "resolved" ? "Complete all pending suggestions and apply at least one field first" : undefined}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--wk-border)] py-2 text-[12px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <WkIcon name="CheckCircle" size={13} />
                Resolve
              </button>
              <button
                onClick={() => onLifecycle("reopened")}
                disabled={lifecycleStatus === "open" || lifecycleLoading}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--wk-border)] py-2 text-[12px] font-bold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <WkIcon name="RotateCcw" size={13} />
                Reopen
              </button>
            </div>
          </div>
        </div>

        {/* Provider context */}
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 text-[12px] text-[var(--wk-text-muted)]">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Provider context</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span>Observations</span>
              <span className="font-bold text-[var(--wk-text)]">{context?.observations.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Provider links</span>
              <span className="font-bold text-[var(--wk-text)]">{context?.providerLinks.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Data source</span>
              <span className="font-bold text-[var(--wk-text)]">Live staging</span>
            </div>
          </div>

          {(context?.observations.length ?? 0) > 0 && (
            <div className="mt-3 border-t border-[var(--wk-border)] pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--wk-text-faint)]">Top observations</p>
              <div className="space-y-1">
                {context?.observations.slice(0, 4).map((obs) => (
                  <div key={obs.id} className="flex items-start gap-2">
                    <span className="font-semibold text-[var(--wk-text-soft)] whitespace-nowrap">{obs.fieldName}:</span>
                    <span className="break-words">{obs.fieldValue ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview panel */}
        {applyPreview && !showConfirmModal && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-bold text-emerald-800">
                  {applyPreview.willCreateCanonicalRelease ? "Will create canonical release" : "Will update canonical release"}
                </p>
                <p className="text-[11px] text-emerald-700">
                  {applyPreview.writable.length} field(s) ready to write · {applyPreview.skipped.length} will be skipped
                </p>
              </div>
              <button onClick={onCancelPreview} className="shrink-0 text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">
                <WkIcon name="X" size={14} />
              </button>
            </div>

            <div className="space-y-1 mb-3">
              {applyPreview.writable.map((item) => (
                <div key={item.suggestionId} className="flex items-center gap-2 text-[12px]">
                  <WkIcon name="Check" size={12} className="shrink-0 text-emerald-600" />
                  <span className="font-semibold text-emerald-900">{item.fieldName}</span>
                  <WkIcon name="ArrowRight" size={11} className="text-emerald-400 shrink-0" />
                  <span className="text-emerald-700 truncate">{item.proposedValue}</span>
                </div>
              ))}
              {applyPreview.skipped.map((item) => (
                <div key={item.suggestionId} className="flex items-center gap-2 text-[11px] opacity-70">
                  <WkIcon name="Minus" size={12} className="shrink-0 text-amber-600" />
                  <span className="text-amber-800">{item.fieldName}: {item.reason ?? "Not writable"}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onApply}
              disabled={applyPreview.writable.length === 0 || applyLoading || lifecycleStatus === "resolved"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <WkIcon name="Zap" size={14} />
              Apply {applyPreview.writable.length} field{applyPreview.writable.length !== 1 ? "s" : ""} to canonical release
            </button>
          </div>
        )}

        {/* Audit trail */}
        {auditEvents.length > 0 && (
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">
              Audit trail · {auditEvents.length} event(s)
            </p>
            <div className="space-y-2">
              {auditEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      event.status === "applied" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                      event.status === "failed" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
                      "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                    }`}>
                      {event.status}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--wk-text)]">{event.fieldName}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[var(--wk-text-faint)]">
                    {new Date(event.createdAt).toLocaleString()} · {event.actor}
                  </p>
                  {event.errorMessage && (
                    <p className="mt-1 text-[10px] text-[var(--wk-danger)]">{event.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recently Updated Activity Feed ───────────────────────────────────────────

interface RecentActivityItem {
  id: string;
  type: "suggestion_decided" | "lifecycle_changed" | "canonical_write";
  registryEntityId: string;
  title: string;
  description: string;
  actor: string;
  createdAt: string;
  status: string;
}

function RecentActivityFeed() {
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const [suggestionsResult, lifecycleResult, writesResult] = await Promise.all([
          supabase
            .from("registry_enrichment_suggestions")
            .select("id, registry_entity_id, field_name, decision_status, created_at")
            .eq("registry_entity_type", "release")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("registry_release_shell_lifecycle_events")
            .select("id, registry_entity_id, status, actor, reason, created_at")
            .eq("registry_entity_type", "release")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("registry_canonical_write_events")
            .select("id, registry_entity_id, field_name, action, status, actor, created_at")
            .eq("registry_entity_type", "release")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        if (cancelled) return;

        const merged: RecentActivityItem[] = [];

        (suggestionsResult.data ?? []).forEach((s: Record<string, unknown>) => {
          merged.push({
            id: `sug-${s.id}`,
            type: "suggestion_decided",
            registryEntityId: String(s.registry_entity_id ?? ""),
            title: String(s.field_name ?? "unknown field"),
            description: `Suggestion "${s.field_name}" → ${s.decision_status}`,
            actor: "system",
            createdAt: String(s.created_at ?? ""),
            status: String(s.decision_status ?? "draft"),
          });
        });

        (lifecycleResult.data ?? []).forEach((e: Record<string, unknown>) => {
          merged.push({
            id: `life-${e.id}`,
            type: "lifecycle_changed",
            registryEntityId: String(e.registry_entity_id ?? ""),
            title: `Shell ${e.status}`,
            description: `Lifecycle → ${e.status}${e.reason ? `: ${String(e.reason).slice(0, 80)}` : ""}`,
            actor: String(e.actor ?? "system"),
            createdAt: String(e.created_at ?? ""),
            status: String(e.status ?? "open"),
          });
        });

        (writesResult.data ?? []).forEach((e: Record<string, unknown>) => {
          merged.push({
            id: `write-${e.id}`,
            type: "canonical_write",
            registryEntityId: String(e.registry_entity_id ?? ""),
            title: String(e.field_name ?? e.action ?? "write"),
            description: `Canonical write "${e.field_name ?? e.action}" → ${e.status}`,
            actor: String(e.actor ?? "system"),
            createdAt: String(e.created_at ?? ""),
            status: String(e.status ?? "unknown"),
          });
        });

        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(merged.slice(0, 20));
      } catch {
        // Activity feed is best-effort; never block the page on it
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  const statusBadge = (status: string) => {
    if (status === "approved" || status === "applied" || status === "resolved") return "bg-emerald-100 text-emerald-700";
    if (status === "rejected" || status === "failed") return "bg-red-100 text-red-700";
    if (status === "needs_review" || status === "reopened") return "bg-amber-100 text-amber-700";
    return "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]";
  };

  const typeIcon = (type: string) => {
    if (type === "suggestion_decided") return "FileEdit";
    if (type === "lifecycle_changed") return "GitBranch";
    return "Zap";
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <WkIcon name="Clock" size={16} className="text-[#5f8f2f]" />
          <h3 className="text-[13px] font-black text-[#171712]">Recently Updated</h3>
        </div>
        <div className="flex items-center gap-2 py-8 justify-center text-[12px] text-[#697062]">
          <WkIcon name="Loader2" size={14} className="animate-spin" />
          Loading activity…
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <WkIcon name="Clock" size={16} className="text-[#5f8f2f]" />
        <h3 className="text-[13px] font-black text-[#171712]">Recently Updated</h3>
        <span className="ml-auto rounded-full bg-[#f0f3ec] px-2.5 py-0.5 text-[10px] font-bold text-[#5f8f2f]">
          {items.length} events
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[#858c7e]">
          No recent activity in the enrichment queue. Suggestions and lifecycle events will appear here as they happen.
        </p>
      ) : (
        <div className="space-y-1 max-h-[520px] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fbfcf8] transition-colors"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f0f3ec] text-[#5f8f2f]">
                <WkIcon name={typeIcon(item.type)} size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-bold text-[#171712] truncate">{item.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#697062] truncate">{item.description}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[#b8bfb2]">
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  <span>·</span>
                  <span>{item.actor}</span>
                  <span>·</span>
                  <span className="font-mono text-[9px]">{item.registryEntityId.slice(0, 12)}…</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminRegistryReleaseShells() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showIntakeDrawer, setShowIntakeDrawer] = useState(false);

  // Auto-open intake drawer when navigating to the /intake route
  useEffect(() => {
    if (location.pathname.includes("/intake")) {
      setShowIntakeDrawer(true);
    }
  }, [location.pathname]);

  const [queueFilter, setQueueFilter] = useState<QueueFilter>("active");
  const [includeResolved, setIncludeResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const shouldIncludeResolved = includeResolved || queueFilter === "all" || queueFilter === "resolved";
      const { shells, contexts } = await getLiveReleaseShellReviewRows({ includeResolved: shouldIncludeResolved });

      setShellRows(shells);
      setEnrichmentByShell(contexts);

      const auditEntries = await Promise.all(
        shells.map(async (shell) => [
          shell.shellKey,
          await getReleaseShellCanonicalWriteAuditEvents(shell.releaseShellId ?? shell.id),
        ] as const),
      );
      setAuditByShell(Object.fromEntries(auditEntries));
    } catch (err) {
      setShellRows([]);
      setEnrichmentByShell({});
      setAuditByShell({});
      setErrorMessage(err instanceof Error ? err.message : "Failed to load live release shells.");
    } finally {
      setLoading(false);
    }
  }, [includeResolved, queueFilter]);

  const handleCloseIntakeDrawer = useCallback(() => {
    setShowIntakeDrawer(false);
    if (location.pathname.includes("/intake")) {
      navigate("/admin/registry/release-shells", { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleIntakeComplete = useCallback(() => {
    setShowIntakeDrawer(false);
    if (location.pathname.includes("/intake")) {
      navigate("/admin/registry/release-shells", { replace: true });
    }
    load();
  }, [location.pathname, navigate, load]);

  const [shellRows, setShellRows] = useState<RegistryReleaseShellReviewRow[]>([]);
  const [enrichmentByShell, setEnrichmentByShell] = useState<Record<string, ReleaseShellEnrichmentContext>>({});
  const [auditByShell, setAuditByShell] = useState<Record<string, CanonicalWriteAuditEvent[]>>({});
  const [overrides, setOverrides] = useState<Record<string, EnrichmentDecisionStatus>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [previewByShell, setPreviewByShell] = useState<Record<string, ApplyApprovedReleaseShellSuggestionsPreview>>({});
  const [previewLoadingByShell, setPreviewLoadingByShell] = useState<Record<string, boolean>>({});
  const [applyLoadingByShell, setApplyLoadingByShell] = useState<Record<string, boolean>>({});
  const [lifecycleLoadingByShell, setLifecycleLoadingByShell] = useState<Record<string, boolean>>({});
  const [confirmModalShellKey, setConfirmModalShellKey] = useState<string | null>(null);
  const [selectedShellKeys, setSelectedShellKeys] = useState<Record<string, boolean>>({});
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const queueSummary = useMemo(() => {
    const summary = { open: 0, needs_review: 0, ready_to_apply: 0, partially_applied: 0, failed_write: 0, resolved: 0, reopened: 0 };
    shellRows.forEach((row) => {
      const status = computeShellStatus(enrichmentByShell[row.shellKey], auditByShell[row.shellKey] ?? [], overrides);
      summary[status] = (summary[status] ?? 0) + 1;
    });
    return summary;
  }, [shellRows, enrichmentByShell, auditByShell, overrides]);

  const allSuggestions = useMemo(
    () => Object.values(enrichmentByShell).flatMap((c) => c.suggestions),
    [enrichmentByShell],
  );

  const pendingSuggestions = allSuggestions.filter((s) => (overrides[s.id] ?? s.decisionStatus) === "draft").length;
  const needsReviewSuggestions = allSuggestions.filter((s) => (overrides[s.id] ?? s.decisionStatus) === "needs_review").length;
  const approvedSuggestions = allSuggestions.filter((s) => (overrides[s.id] ?? s.decisionStatus) === "approved").length;
  const avgConfidence = shellRows.length > 0 ? Math.round(shellRows.reduce((s, r) => s + r.confidence, 0) / shellRows.length) : 0;

  const filtered = useMemo(() => {
    return shellRows.filter((row) => {
      const status = computeShellStatus(enrichmentByShell[row.shellKey], auditByShell[row.shellKey] ?? [], overrides);
      const active = status !== "resolved";

      const matchesFilter =
        queueFilter === "all" ? true :
        queueFilter === "active" ? active :
        status === queueFilter;

      if (!matchesFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      return [row.title, row.artistNames.join(", "), row.releaseShellId ?? "", status].some(
        (v) => v.toLowerCase().includes(q),
      );
    });
  }, [shellRows, enrichmentByShell, auditByShell, overrides, queueFilter, search]);

  // ── Suggestion decisions ───────────────────────────────────────────────────

  const handleDecide = async (
    suggestion: RegistryEnrichmentSuggestionReviewItem,
    decision: LocalSuggestionDecision,
  ) => {
    const previous = overrides[suggestion.id];
    setSavingIds((p) => ({ ...p, [suggestion.id]: true }));
    setOverrides((p) => ({ ...p, [suggestion.id]: decision }));

    try {
      const persisted = await updateReleaseShellSuggestionDecision(suggestion.id, decision);
      setOverrides((p) => ({ ...p, [suggestion.id]: persisted.decisionStatus }));
      setEnrichmentByShell((prev) => {
        const next = { ...prev };
        for (const [key, ctx] of Object.entries(next)) {
          if (!ctx.suggestions.some((s) => s.id === suggestion.id)) continue;
          next[key] = { ...ctx, suggestions: ctx.suggestions.map((s) => s.id === suggestion.id ? { ...s, decisionStatus: persisted.decisionStatus } : s) };
        }
        return next;
      });
      // Clear any stale preview since suggestions changed
      setPreviewByShell((p) => {
        const next = { ...p };
        for (const [key, ctx] of Object.entries(enrichmentByShell)) {
          if (ctx.suggestions.some((s) => s.id === suggestion.id)) delete next[key];
        }
        return next;
      });
      showToast(`${suggestion.fieldName} → ${decision}`, "success");
    } catch (err) {
      setOverrides((p) => {
        const next = { ...p };
        if (previous) next[suggestion.id] = previous;
        else delete next[suggestion.id];
        return next;
      });
      showToast(err instanceof Error ? err.message : "Failed to save decision.", "error");
    } finally {
      setSavingIds((p) => { const n = { ...p }; delete n[suggestion.id]; return n; });
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────────

  const handlePreview = async (row: RegistryReleaseShellReviewRow) => {
    const registryEntityId = row.releaseShellId ?? row.id;
    setPreviewLoadingByShell((p) => ({ ...p, [row.shellKey]: true }));
    try {
      const preview = await previewApprovedReleaseShellSuggestions(registryEntityId);
      setPreviewByShell((p) => ({ ...p, [row.shellKey]: preview }));
      showToast(preview.willCreateCanonicalRelease ? "Preview ready — new canonical release will be created." : "Preview ready — existing canonical release will be updated.", "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to preview.", "error");
    } finally {
      setPreviewLoadingByShell((p) => { const n = { ...p }; delete n[row.shellKey]; return n; });
    }
  };

  // ── Apply ─────────────────────────────────────────────────────────────────

  const handleApply = async (row: RegistryReleaseShellReviewRow) => {
    const registryEntityId = row.releaseShellId ?? row.id;
    setConfirmModalShellKey(null);
    setApplyLoadingByShell((p) => ({ ...p, [row.shellKey]: true }));

    try {
      const result = await applyApprovedReleaseShellSuggestions(registryEntityId);

      if (result.applied.length === 0) {
        showToast(`No fields applied. ${result.skipped.length} skipped.`, "info");
        return;
      }

      setOverrides((p) => ({
        ...p,
        ...Object.fromEntries(result.applied.map((a) => [a.suggestionId, "applied" as EnrichmentDecisionStatus])),
      }));

      const events = await getReleaseShellCanonicalWriteAuditEvents(registryEntityId);
      setAuditByShell((p) => ({ ...p, [row.shellKey]: events }));
      setPreviewByShell((p) => { const n = { ...p }; delete n[row.shellKey]; return n; });

      showToast(`Applied ${result.applied.length} field(s) to canonical release.`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Apply failed.", "error");
    } finally {
      setApplyLoadingByShell((p) => { const n = { ...p }; delete n[row.shellKey]; return n; });
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  const handleLifecycle = async (row: RegistryReleaseShellReviewRow, status: "resolved" | "reopened") => {
    const registryEntityId = row.releaseShellId ?? row.id;
    setLifecycleLoadingByShell((p) => ({ ...p, [row.shellKey]: true }));
    try {
      const reason = status === "resolved"
        ? "All reviewed suggestions applied or intentionally skipped."
        : "Shell reopened for additional registry review.";
      await updateReleaseShellLifecycleStatus(registryEntityId, status, reason);
      showToast(`Shell ${status}.`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${status} shell.`, "error");
    } finally {
      setLifecycleLoadingByShell((p) => { const n = { ...p }; delete n[row.shellKey]; return n; });
    }
  };

  // ── Bulk operations ───────────────────────────────────────────────────────

  const selectedRows = filtered.filter((r) => selectedShellKeys[r.shellKey]);
  const selectedCount = selectedRows.length;

  const bulkLifecycle = async (status: "resolved" | "reopened") => {
    if (!selectedRows.length) { showToast("Select at least one shell first.", "info"); return; }
    setBulkActionLoading(true);
    let updated = 0; let skipped = 0;
    try {
      for (const row of selectedRows) {
        const st = computeShellStatus(enrichmentByShell[row.shellKey], auditByShell[row.shellKey] ?? [], overrides);
        if (status === "resolved" && (st === "resolved" || st === "needs_review" || st === "failed_write")) { skipped++; continue; }
        if (status === "reopened" && st !== "resolved") { skipped++; continue; }
        const reason = status === "resolved" ? "Bulk resolved." : "Bulk reopened.";
        await updateReleaseShellLifecycleStatus(row.releaseShellId ?? row.id, status, reason);
        updated++;
      }
      setSelectedShellKeys({});
      showToast(`Bulk ${status}: ${updated} updated, ${skipped} skipped.`, updated > 0 ? "success" : "info");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Bulk ${status} failed.`, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ── Confirm modal row ─────────────────────────────────────────────────────

  const confirmRow = confirmModalShellKey ? shellRows.find((r) => r.shellKey === confirmModalShellKey) : null;
  const confirmPreview = confirmModalShellKey ? previewByShell[confirmModalShellKey] : null;

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-[#dfe4d8] bg-[#f7f7f2]">
        <div className="flex flex-col items-center gap-3 text-center">
          <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
          <p className="text-[14px] font-bold text-[#171712]">Loading live release shells…</p>
          <p className="text-[12px] text-[#697062]">Querying Phase 8C enrichment staging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] space-y-5">
      {/* Intake drawer */}
      {showIntakeDrawer && (
        <ReleaseShellIntakeDrawer
          onClose={handleCloseIntakeDrawer}
          onShellCreated={handleIntakeComplete}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-5 py-3 text-[13px] font-bold shadow-xl transition-all ${
          toast.type === "success" ? "border-emerald-200 bg-white text-emerald-800" :
          toast.type === "error" ? "border-red-200 bg-white text-red-800" :
          "border-[#dfe4d8] bg-white text-[#171712]"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Confirm apply modal */}
      {confirmRow && confirmPreview && (
        <ConfirmApplyModal
          preview={confirmPreview}
          applying={Boolean(applyLoadingByShell[confirmRow.shellKey])}
          onConfirm={() => handleApply(confirmRow)}
          onCancel={() => setConfirmModalShellKey(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">Registry</p>
          <h1 className="text-[26px] font-black tracking-tight text-[#171712]">Release Shells</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#697062]">
            Canonicalization workbench for provisional releases. Review provider field suggestions,
            preview writes, apply to canonical registry, and resolve shells through a gated workflow.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowIntakeDrawer(true)}
            className="rounded-2xl bg-[#5f8f2f] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#4d7526] flex items-center gap-2 whitespace-nowrap"
          >
            <WkIcon name="Plus" size={14} />
            Start intake
          </button>
          <button
            onClick={() => setIncludeResolved((v) => !v)}
            className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441]"
          >
            {includeResolved ? "Hide resolved" : "Show resolved"}
          </button>
          <button
            onClick={load}
            className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441] flex items-center gap-2"
          >
            <WkIcon name="RefreshCcw" size={13} />
            Refresh
          </button>
          <button
            onClick={() => navigate("/admin/registry/releases")}
            className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#5f8f2f] hover:border-[#85c441]"
          >
            Registry Releases
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {[
          { label: "Total shells", value: shellRows.length, sub: null },
          { label: "Open", value: queueSummary.open, sub: null, color: "text-[#171712]" },
          { label: "Needs review", value: queueSummary.needs_review, sub: null, color: queueSummary.needs_review > 0 ? "text-amber-700" : undefined },
          { label: "Ready to apply", value: queueSummary.ready_to_apply, sub: null, color: queueSummary.ready_to_apply > 0 ? "text-emerald-700" : undefined },
          { label: "Failed writes", value: queueSummary.failed_write, sub: null, color: queueSummary.failed_write > 0 ? "text-red-700" : undefined },
          { label: "Resolved", value: queueSummary.resolved, sub: null },
          { label: "Avg confidence", value: `${avgConfidence}%`, sub: null },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b]">{label}</p>
            <p className={`mt-1.5 text-[22px] font-black ${color ?? "text-[#171712]"}`}>{value}</p>
            {sub && <p className="mt-0.5 text-[10px] font-semibold text-[#71796b]">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Suggestion summary strip */}
      {allSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-full border border-[#dfe4d8] bg-white px-4 py-2 text-[12px] font-bold text-[#71796b]">
            {pendingSuggestions} pending suggestions
          </div>
          {needsReviewSuggestions > 0 && (
            <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-bold text-amber-700">
              {needsReviewSuggestions} flagged for review
            </div>
          )}
          {approvedSuggestions > 0 && (
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] font-bold text-emerald-700">
              {approvedSuggestions} approved — ready to apply
            </div>
          )}
        </div>
      )}

      {/* Bulk operations */}
      {selectedCount > 0 && (
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4 flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-bold text-[#171712]">{selectedCount} shell(s) selected</span>
          <button
            onClick={() => bulkLifecycle("resolved")}
            disabled={bulkActionLoading}
            className="rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#4d7526] disabled:opacity-50"
          >
            {bulkActionLoading ? "Working…" : "Bulk resolve"}
          </button>
          <button
            onClick={() => bulkLifecycle("reopened")}
            disabled={bulkActionLoading}
            className="rounded-xl border border-[#dfe4d8] px-4 py-2 text-[12px] font-bold text-[#171712] hover:border-[#85c441] disabled:opacity-50"
          >
            Bulk reopen
          </button>
          <button
            onClick={() => setSelectedShellKeys({})}
            className="ml-auto rounded-xl border border-[#dfe4d8] px-4 py-2 text-[12px] font-bold text-[#697062] hover:text-[#171712]"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1 max-w-md">
          <WkIcon name="Search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b8bfb2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, artist, or shell ID…"
            className="h-10 w-full rounded-2xl border border-[#dfe4d8] bg-white pl-10 pr-4 text-[13px] text-[#171712] outline-none focus:border-[#85c441]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ["active", "Active", (queueSummary.open + queueSummary.needs_review + queueSummary.ready_to_apply + queueSummary.partially_applied + queueSummary.failed_write + queueSummary.reopened)],
            ["open", "Open", queueSummary.open],
            ["needs_review", "Needs review", queueSummary.needs_review],
            ["ready_to_apply", "Ready to apply", queueSummary.ready_to_apply],
            ["failed_write", "Failed", queueSummary.failed_write],
            ["resolved", "Resolved", queueSummary.resolved],
            ["all", "All", shellRows.length],
          ] as Array<[QueueFilter, string, number]>).map(([filter, label, count]) => (
            <button
              key={filter}
              onClick={() => setQueueFilter(filter)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-all ${
                queueFilter === filter
                  ? "border-[#85c441] bg-[#f0f7e8] text-[#5f8f2f]"
                  : "border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#85c441]/60"
              }`}
            >
              {label} · {count}
            </button>
          ))}
        </div>
      </div>

      {/* Recently Updated Activity Feed */}
      <RecentActivityFeed />

      {/* Error state */}
      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <WkIcon name="AlertTriangle" size={20} className="shrink-0 text-red-700" />
            <div>
              <p className="text-[13px] font-bold text-red-800">Could not load release shells</p>
              <p className="mt-1 text-[12px] text-red-700">{errorMessage}</p>
              <button
                onClick={load}
                className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white">
        {filtered.length === 0 && !errorMessage ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
              <WkIcon name="FolderCheck" size={28} className="text-[#5f8f2f]" />
            </div>
            <p className="text-[16px] font-black text-[#171712]">
              {search || queueFilter !== "active" ? "No shells match your filters" : "No live release shells ready for review"}
            </p>
            <p className="max-w-md text-[13px] text-[#697062]">
              {search || queueFilter !== "active"
                ? "Try adjusting your search or filter criteria."
                : "Release shells appear here when provider enrichment staging creates suggestions for provisional releases. Run provider enrichment staging to populate this queue."}
            </p>
            {(search || queueFilter !== "active") && (
              <button
                onClick={() => { setSearch(""); setQueueFilter("active"); }}
                className="rounded-xl border border-[#dfe4d8] px-4 py-2 text-[13px] font-bold text-[#697062] hover:border-[#85c441]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid items-center gap-3 border-b border-[#e8ece2] bg-[#fbfcf8] px-5 py-3 text-[10px] font-black uppercase tracking-wider text-[#71796b]"
              style={{ gridTemplateColumns: "32px 36px minmax(0,2fr) minmax(0,1.2fr) minmax(0,0.8fr) 110px 120px 90px 36px" }}
            >
              <span />
              <span>#</span>
              <span>Release</span>
              <span>Artist</span>
              <span>Provider</span>
              <span>Status</span>
              <span>Suggestions</span>
              <span>Actions</span>
              <span />
            </div>

            <div>
              {filtered.map((row) => {
                const context = enrichmentByShell[row.shellKey];
                const auditEvents = auditByShell[row.shellKey] ?? [];
                const shellStatus = computeShellStatus(context, auditEvents, overrides);
                const style = shellStatusStyle(shellStatus);
                const suggestions = context?.suggestions ?? [];
                const groups = groupSuggestions(suggestions, overrides);
                const isExpanded = expandedRows[row.shellKey] ?? false;
                const isSelected = Boolean(selectedShellKeys[row.shellKey]);
                const preview = previewByShell[row.shellKey];
                const providerLink = context?.providerLinks[0];

                return (
                  <Fragment key={row.shellKey}>
                    <div
                      className={`grid items-center gap-3 border-b border-[#eef1ea] px-5 py-4 transition-colors last:border-b-0 ${isExpanded ? "bg-[#fbfcf8]" : "hover:bg-[#fbfcf8]"}`}
                      style={{ gridTemplateColumns: "32px 36px minmax(0,2fr) minmax(0,1.2fr) minmax(0,0.8fr) 110px 120px 90px 36px" }}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelectedShellKeys((p) => ({ ...p, [row.shellKey]: !p[row.shellKey] }))}
                        className="h-4 w-4 rounded border-[#dfe4d8] accent-[#85c441]"
                      />

                      {/* Rank */}
                      <span className="text-[13px] font-bold text-[#71796b]">{row.rank}</span>

                      {/* Release info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {row.artworkUrl ? (
                          <img src={row.artworkUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0f3ec] text-[11px] font-black text-[#8a9283]">
                            R
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-black text-[#171712]">{row.title}</p>
                          <p className="truncate text-[11px] text-[#858c7e]">{row.releaseShellId || row.id}</p>
                        </div>
                      </div>

                      {/* Artist */}
                      <p className="truncate text-[13px] text-[#5d6557]">{row.artistNames.join(", ") || "—"}</p>

                      {/* Provider */}
                      <div>
                        <span className="rounded-full border border-[#dfe4d8] bg-[#f8f9f4] px-2.5 py-1 text-[10px] font-bold text-[#71796b] uppercase tracking-wide">
                          {providerLink?.provider ?? "registry"} · {row.confidence}%
                        </span>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>

                      {/* Suggestion progress */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[#171712]">
                            {groups.approved.length + groups.applied.length}
                          </span>
                          <span className="text-[10px] text-[#858c7e]">/ {suggestions.length}</span>
                        </div>
                        {suggestions.length > 0 && (
                          <div className="h-1 overflow-hidden rounded-full bg-[#eef1e8]">
                            <div
                              className="h-full rounded-full bg-[#85c441]"
                              style={{ width: `${suggestions.length > 0 ? Math.round(((groups.approved.length + groups.applied.length) / suggestions.length) * 100) : 0}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Review button */}
                      <div>
                        <button
                          onClick={() => setExpandedRows((p) => ({ ...p, [row.shellKey]: !p[row.shellKey] }))}
                          className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#5f8f2f] hover:border-[#85c441] hover:bg-[#f0f7e8] transition-colors whitespace-nowrap"
                        >
                          {isExpanded ? "Close" : "Review"}
                        </button>
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedRows((p) => ({ ...p, [row.shellKey]: !p[row.shellKey] }))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#85c441] transition-colors"
                      >
                        <WkIcon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} />
                      </button>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div className="border-b border-[#eef1ea] bg-white px-5 py-5">
                        <ShellPanel
                          row={row}
                          context={context}
                          auditEvents={auditEvents}
                          overrides={overrides}
                          savingIds={savingIds}
                          applyPreview={preview}
                          previewLoading={Boolean(previewLoadingByShell[row.shellKey])}
                          applyLoading={Boolean(applyLoadingByShell[row.shellKey])}
                          lifecycleLoading={Boolean(lifecycleLoadingByShell[row.shellKey])}
                          showConfirmModal={confirmModalShellKey === row.shellKey}
                          onDecide={handleDecide}
                          onPreview={() => handlePreview(row)}
                          onCancelPreview={() => setPreviewByShell((p) => { const n = { ...p }; delete n[row.shellKey]; return n; })}
                          onApply={() => {
                            setConfirmModalShellKey(row.shellKey);
                          }}
                          onLifecycle={(status) => handleLifecycle(row, status)}
                        />
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
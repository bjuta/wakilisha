import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import type { VideoPublicationWorkspace } from "@/services/video/videoAdminService";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function VideoCorrectionProvenanceWorkspace({
  workspace,
}: {
  workspace: VideoPublicationWorkspace;
}) {
  const provenance = workspace.correctionProvenance;

  return (
    <AdminWorkspaceSection
      icon="History"
      title="Corrections and Provenance"
      note="Shared Correction authority binds challenges to exact immutable Video Resource Versions."
    >
      {!provenance.canView ? (
        <p className="text-xs text-wk-text-muted">
          Correction provenance is available to correction reviewers.
        </p>
      ) : !provenance.cases.length ? (
        <p className="text-xs text-wk-text-muted">
          No correction cases target this Video.
        </p>
      ) : (
        <div className="space-y-3">
          {provenance.cases.map((item) => (
            <div
              key={item.targetId}
              className="rounded-xl border border-wk-border bg-wk-bg p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-wk-text">
                  {item.caseReference}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                  {humanize(item.caseState)}
                </span>
              </div>
              <p className="mt-2 text-xs text-wk-text-muted">
                {item.targetSummary || humanize(item.correctionKind || "correction")}
              </p>
              <div className="mt-3 grid gap-2 text-[11px] text-wk-text-muted sm:grid-cols-2">
                <span>
                  Version {item.versionNumber || "?"} · {humanize(item.versionKind || "published")}
                </span>
                <span className="truncate font-mono">
                  {item.targetVersionId}
                </span>
                {item.currentDecisionOutcome ? (
                  <span>
                    Decision: {humanize(item.currentDecisionOutcome)}
                  </span>
                ) : null}
                {item.observedContentFingerprint ? (
                  <span className="truncate font-mono">
                    {item.observedContentFingerprint}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminWorkspaceSection>
  );
}

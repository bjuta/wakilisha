import { useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import { TrustAttachmentPicker } from "@/components/design-system/trust/TrustAttachmentPicker";
import {
  EditorialCreditPicker,
  type EditorialCreditSelection,
} from "@/components/design-system/trust/EditorialCreditPicker";
import {
  fetchEditorialCreditPickerAuthority,
  resolveEditorialCredit,
  searchEditorialCreditParties,
  type EditorialCreditPickerAuthority,
} from "@/services/trust/editorialCreditService";
import { fetchVideoTrustCandidates } from "@/services/video/videoTrustCandidateService";
import {
  replaceVideoPublicationVersionCitations,
  replaceVideoPublicationVersionCredits,
  type VideoPublicationWorkspace,
} from "@/services/video/videoAdminService";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Video Trust could not be updated.";
}

export function VideoTrustWorkspace({
  workspace,
  onReload,
}: {
  workspace: VideoPublicationWorkspace;
  onReload: () => Promise<void>;
}) {
  const [creditAuthority, setCreditAuthority] =
    useState<EditorialCreditPickerAuthority | null>(null);
  const [citationCandidates, setCitationCandidates] = useState<
    Awaited<ReturnType<typeof fetchVideoTrustCandidates>>["citations"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      fetchVideoTrustCandidates(),
      fetchEditorialCreditPickerAuthority(),
    ])
      .then(([candidateResult, creditResult]) => {
        if (!alive) return;
        const warnings: string[] = [];

        if (candidateResult.status === "fulfilled") {
          setCitationCandidates(candidateResult.value.citations);
        } else {
          setCitationCandidates([]);
          warnings.push(`Citations: ${errorText(candidateResult.reason)}`);
        }

        if (creditResult.status === "fulfilled") {
          setCreditAuthority(creditResult.value);
        } else {
          setCreditAuthority(null);
          warnings.push(`Credits: ${errorText(creditResult.reason)}`);
        }

        setMessage(warnings.length ? warnings.join(" ") : null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [workspace.publication.id]);

  const creditIds = useMemo(
    () => workspace.trust.credits.map((credit) => credit.creditId),
    [workspace.trust.credits],
  );
  const citationIds = useMemo(
    () => workspace.trust.citations.map((citation) => citation.citationId),
    [workspace.trust.citations],
  );

  const editable = Boolean(
    workspace.capabilities.canEdit &&
      workspace.resource.versions.working &&
      ["draft", "changes_requested"].includes(workspace.resource.lifecycleState),
  );

  async function saveCredits(nextIds: string[]) {
    setBusy("credits");
    setMessage(null);
    try {
      await replaceVideoPublicationVersionCredits(workspace, nextIds);
      await onReload();
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function addCredit(selection: EditorialCreditSelection) {
    setBusy("credits");
    setMessage(null);
    try {
      const resolved = await resolveEditorialCredit(selection);
      const nextIds = creditIds.includes(resolved.creditId)
        ? creditIds
        : [...creditIds, resolved.creditId];
      await replaceVideoPublicationVersionCredits(workspace, nextIds);
      await onReload();
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function saveCitations(nextIds: string[]) {
    setBusy("citations");
    setMessage(null);
    try {
      await replaceVideoPublicationVersionCitations(workspace, nextIds);
      await onReload();
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminWorkspaceSection
      icon="Quote"
      title="Credits and Citations"
      note="Shared Trust attaches to the exact working Video version and follows that version through review and publication."
    >
      {!workspace.resource.versions.working ? (
        <div className="mb-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs text-wk-text-muted">
          Save a working Video version before changing Credits or Citations.
        </div>
      ) : null}

      {message ? (
        <div role="status" className="mb-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs text-wk-text">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-black text-wk-text">Credits</h3>
          <div className="mt-2 space-y-2">
            {workspace.trust.credits.map((credit) => (
              <div
                key={credit.attachmentId}
                className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-wk-text">
                    {credit.displayName}
                  </span>
                  <span className="block text-[11px] text-wk-text-muted">
                    {credit.roleLabel || humanize(credit.creditRole)}
                  </span>
                </span>
                {editable ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void saveCredits(
                        creditIds.filter((id) => id !== credit.creditId),
                      )
                    }
                    className="text-wk-danger disabled:opacity-40"
                    aria-label={`Remove Credit for ${credit.displayName}`}
                  >
                    <WkIcon name="X" size={14} />
                  </button>
                ) : null}
              </div>
            ))}
            {!workspace.trust.credits.length ? (
              <p className="text-xs text-wk-text-muted">No Credits attached.</p>
            ) : null}
          </div>

          {editable && creditAuthority ? (
            <EditorialCreditPicker
              roles={creditAuthority.roles}
              canCreateCredit={creditAuthority.canCreateCredit}
              disabled={busy !== null || loading}
              onSearch={searchEditorialCreditParties}
              onAttach={(selection) => void addCredit(selection)}
            />
          ) : editable ? (
            <p className="mt-3 rounded-lg border border-dashed border-wk-border px-3 py-3 text-xs text-wk-text-muted">
              Credit identity tools are temporarily unavailable. The Video record remains editable.
            </p>
          ) : null}
        </div>

        <div>
          <h3 className="text-xs font-black text-wk-text">Citations</h3>
          <div className="mt-2 space-y-2">
            {workspace.trust.citations.map((citation) => (
              <div
                key={citation.attachmentId}
                className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-wk-text">
                    {citation.publicLabel || "Citation"}
                  </span>
                  <span className="block text-[11px] text-wk-text-muted">
                    {humanize(citation.citationPurpose)}
                  </span>
                </span>
                {editable ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void saveCitations(
                        citationIds.filter((id) => id !== citation.citationId),
                      )
                    }
                    className="text-wk-danger disabled:opacity-40"
                    aria-label="Remove Citation"
                  >
                    <WkIcon name="X" size={14} />
                  </button>
                ) : null}
              </div>
            ))}
            {!workspace.trust.citations.length ? (
              <p className="text-xs text-wk-text-muted">No Citations attached.</p>
            ) : null}
          </div>

          {editable ? (
            <TrustAttachmentPicker
              noun="Citation"
              options={citationCandidates}
              attachedIds={citationIds}
              disabled={busy !== null || loading}
              onAttach={(id) =>
                void saveCitations(
                  citationIds.includes(id) ? citationIds : [...citationIds, id],
                )
              }
            />
          ) : null}
        </div>
      </div>
    </AdminWorkspaceSection>
  );
}

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type { Json } from "@/types/database.types";
import {
  ArticleTrustServiceError,
  attachArticleVersionCitation,
  createCitation,
  type ArticleTrustCitationIntakeOptions,
  type ArticleTrustSourceSummary,
} from "@/services/articles/articleTrustService";

interface Props {
  articleVersionId: string;
  expectedCitationRevision: number;
  nextDisplayOrder: number;
  sources: ArticleTrustSourceSummary[];
  options: ArticleTrustCitationIntakeOptions;
  onClose: () => void;
  onAttached: () => void;
  onConcurrency: () => void;
}

function record(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredId(
  value: unknown,
  key: string,
  message: string,
): string {
  const candidate = record(value)[key];

  if (
    typeof candidate !== "string" ||
    !candidate.trim()
  ) {
    throw new Error(message);
  }

  return candidate.trim();
}

function requiredText(
  value: string,
  label: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function integer(
  value: string,
  label: string,
  minimum: number,
): number {
  const normalized = value.trim();

  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error(
      `${label} must be a whole number.`,
    );
  }

  const parsed = Number(normalized);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum
  ) {
    throw new Error(
      `${label} must be ${minimum} or greater.`,
    );
  }

  return parsed;
}

function sourceApprovedForPublic(
  source: ArticleTrustSourceSummary | null,
): boolean {
  return Boolean(
    source &&
      source.sourceState === "active" &&
      source.reviewStatus === "approved" &&
      source.currentApprovedVersionId &&
      (
        source.exposureClass === "public" ||
        source.exposureClass ===
          "public_redacted"
      ),
  );
}

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

export function ArticleCitationForm({
  articleVersionId,
  expectedCitationRevision,
  nextDisplayOrder,
  sources,
  options,
  onClose,
  onAttached,
  onConcurrency,
}: Props) {
  const eligibleSources = useMemo(
    () =>
      sources.filter(
        (source) =>
          source.sourceState === "active" &&
          source.reviewStatus === "approved" &&
          Boolean(
            source.currentApprovedVersionId,
          ),
      ),
    [sources],
  );

  const defaultLocatorType =
    options.locatorTypes.some(
      (option) =>
        option.locatorType === "whole_source",
    )
      ? "whole_source"
      : options.locatorTypes[0]
          ?.locatorType ?? "";

  const defaultPurpose =
    options.citationPurposes.some(
      (option) => option.value === "supports",
    )
      ? "supports"
      : options.citationPurposes[0]
          ?.value ?? "";

  const defaultAnchorType =
    options.targetAnchorTypes.some(
      (option) =>
        option.value === "whole_version",
    )
      ? "whole_version"
      : options.targetAnchorTypes[0]
          ?.value ?? "";

  const [sourceId, setSourceId] = useState(
    eligibleSources[0]?.id ?? "",
  );
  const [locatorType, setLocatorType] =
    useState(defaultLocatorType);
  const [citationPurpose, setCitationPurpose] =
    useState(defaultPurpose);
  const [targetAnchorType, setTargetAnchorType] =
    useState(defaultAnchorType);

  const [page, setPage] = useState("");
  const [startPage, setStartPage] =
    useState("");
  const [endPage, setEndPage] =
    useState("");
  const [paragraph, setParagraph] =
    useState("");
  const [quotation, setQuotation] =
    useState("");
  const [milliseconds, setMilliseconds] =
    useState("");
  const [
    startMilliseconds,
    setStartMilliseconds,
  ] = useState("");
  const [
    endMilliseconds,
    setEndMilliseconds,
  ] = useState("");
  const [chapter, setChapter] =
    useState("");
  const [frame, setFrame] = useState("");
  const [sheet, setSheet] = useState("");
  const [row, setRow] = useState("");
  const [cell, setCell] = useState("");
  const [archiveIdentifier, setArchiveIdentifier] =
    useState("");
  const [sectionHeading, setSectionHeading] =
    useState("");
  const [otherLocatorLabel, setOtherLocatorLabel] =
    useState("");

  const [blockId, setBlockId] = useState("");
  const [headingId, setHeadingId] =
    useState("");
  const [paragraphId, setParagraphId] =
    useState("");
  const [characterStart, setCharacterStart] =
    useState("");
  const [characterEnd, setCharacterEnd] =
    useState("");
  const [nodeId, setNodeId] = useState("");

  const [editorNote, setEditorNote] =
    useState("");
  const [publicLabel, setPublicLabel] =
    useState("");
  const [
    citationPublicSafe,
    setCitationPublicSafe,
  ] = useState(false);
  const [
    attachmentPublicSafe,
    setAttachmentPublicSafe,
  ] = useState(false);
  const [
    publicReviewConfirmed,
    setPublicReviewConfirmed,
  ] = useState(false);
  const [
    createdCitationId,
    setCreatedCitationId,
  ] = useState<string | null>(null);
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const selectedSource =
    eligibleSources.find(
      (source) => source.id === sourceId,
    ) ?? null;

  const selectedSourceVersionId =
    selectedSource?.currentApprovedVersionId ||
    null;

  const selectedSourcePublic =
    sourceApprovedForPublic(selectedSource);

  const citationLocked =
    createdCitationId !== null;

  const publicPresentation =
    citationPublicSafe ||
    attachmentPublicSafe;

  useEffect(() => {
    if (
      eligibleSources.length > 0 &&
      !eligibleSources.some(
        (source) => source.id === sourceId,
      )
    ) {
      setSourceId(eligibleSources[0].id);
    }
  }, [eligibleSources, sourceId]);

  useEffect(() => {
    if (!selectedSourcePublic) {
      setCitationPublicSafe(false);
      setAttachmentPublicSafe(false);
      setPublicReviewConfirmed(false);
    }
  }, [selectedSourcePublic]);

  useEffect(() => {
    if (!citationPublicSafe) {
      setAttachmentPublicSafe(false);
    }
  }, [citationPublicSafe]);

  useEffect(() => {
    if (!publicPresentation) {
      setPublicReviewConfirmed(false);
    }
  }, [publicPresentation]);

  function requestClose() {
    if (
      createdCitationId &&
      !window.confirm(
        "A Citation has already been created. Closing now will leave it unattached. Continue?",
      )
    ) {
      return;
    }

    onClose();
  }

  function buildLocatorData(): Json {
    switch (locatorType) {
      case "page":
        return {
          page: integer(page, "Page", 1),
        };

      case "page_range": {
        const start = integer(
          startPage,
          "Start page",
          1,
        );
        const end = integer(
          endPage,
          "End page",
          1,
        );

        if (end < start) {
          throw new Error(
            "End page must be at least the start page.",
          );
        }

        return {
          startPage: start,
          endPage: end,
        };
      }

      case "paragraph":
        return {
          paragraph: integer(
            paragraph,
            "Paragraph",
            1,
          ),
        };

      case "quotation":
        return {
          quotation: requiredText(
            quotation,
            "Quotation",
          ),
        };

      case "timestamp":
        return {
          milliseconds: integer(
            milliseconds,
            "Timestamp milliseconds",
            0,
          ),
        };

      case "timestamp_range":
      case "transcript_range": {
        const start = integer(
          startMilliseconds,
          "Start milliseconds",
          0,
        );
        const end = integer(
          endMilliseconds,
          "End milliseconds",
          0,
        );

        if (end < start) {
          throw new Error(
            "End milliseconds must be at least the start milliseconds.",
          );
        }

        return {
          startMilliseconds: start,
          endMilliseconds: end,
        };
      }

      case "chapter":
        return {
          chapter: requiredText(
            chapter,
            "Chapter",
          ),
        };

      case "image_frame":
        return {
          frame: integer(
            frame,
            "Image frame",
            0,
          ),
        };

      case "spreadsheet_row":
        return {
          sheet: requiredText(
            sheet,
            "Spreadsheet sheet",
          ),
          row: integer(
            row,
            "Spreadsheet row",
            1,
          ),
        };

      case "spreadsheet_cell": {
        const normalizedCell =
          requiredText(
            cell,
            "Spreadsheet cell",
          ).toUpperCase();

        if (
          !/^[A-Z]+[1-9][0-9]*$/.test(
            normalizedCell,
          )
        ) {
          throw new Error(
            "Spreadsheet cell must use A1 notation.",
          );
        }

        return {
          sheet: requiredText(
            sheet,
            "Spreadsheet sheet",
          ),
          cell: normalizedCell,
        };
      }

      case "archive_identifier":
        return {
          identifier: requiredText(
            archiveIdentifier,
            "Archive identifier",
          ),
        };

      case "section_heading":
        return {
          heading: requiredText(
            sectionHeading,
            "Section heading",
          ),
        };

      case "whole_source":
        return {};

      case "other":
        return {
          label: requiredText(
            otherLocatorLabel,
            "Locator label",
          ),
        };

      default:
        throw new Error(
          "Choose a supported Citation locator.",
        );
    }
  }

  function buildTargetAnchorData(): Json {
    switch (targetAnchorType) {
      case "whole_version":
        return {};

      case "block_id":
        return {
          blockId: requiredText(
            blockId,
            "Block ID",
          ),
        };

      case "heading_id":
        return {
          headingId: requiredText(
            headingId,
            "Heading ID",
          ),
        };

      case "paragraph_id":
        return {
          paragraphId: requiredText(
            paragraphId,
            "Paragraph ID",
          ),
        };

      case "character_range": {
        const start = integer(
          characterStart,
          "Character start",
          0,
        );
        const end = integer(
          characterEnd,
          "Character end",
          0,
        );

        if (end < start) {
          throw new Error(
            "Character end must be at least the character start.",
          );
        }

        return {
          start,
          end,
        };
      }

      case "structured_node":
        return {
          nodeId: requiredText(
            nodeId,
            "Structured node ID",
          ),
        };

      default:
        throw new Error(
          "Choose a supported Article target anchor.",
        );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage(null);

    if (!articleVersionId.trim()) {
      setErrorMessage(
        "The current Article version is unavailable.",
      );
      return;
    }

    if (
      !createdCitationId &&
      (
        !selectedSource ||
        !selectedSourceVersionId
      )
    ) {
      setErrorMessage(
        "Choose an active approved Source version.",
      );
      return;
    }

    if (
      !createdCitationId &&
      publicPresentation &&
      !selectedSourcePublic
    ) {
      setErrorMessage(
        "Public presentation requires an active approved Source version with public or public-redacted exposure.",
      );
      return;
    }

    if (
      attachmentPublicSafe &&
      !citationPublicSafe
    ) {
      setErrorMessage(
        "A public Article attachment requires a public-safe Citation.",
      );
      return;
    }

    if (
      publicPresentation &&
      !publicReviewConfirmed
    ) {
      setErrorMessage(
        "Confirm the public Citation review before continuing.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const targetAnchorData =
        buildTargetAnchorData();

      let citationId =
        createdCitationId;

      if (!citationId) {
        const locatorData =
          buildLocatorData();

        const result = await createCitation({
          p_source_id: selectedSource.id,
          p_source_version_id:
            selectedSourceVersionId,
          p_locator_type: locatorType,
          p_locator_data: locatorData,
          p_public_safe:
            citationPublicSafe,
          ...(quotation.trim()
            ? {
                p_quotation:
                  quotation.trim(),
              }
            : {}),
          ...(editorNote.trim()
            ? {
                p_editor_note:
                  editorNote.trim(),
              }
            : {}),
          ...(publicLabel.trim()
            ? {
                p_public_label:
                  publicLabel.trim(),
              }
            : {}),
        });

        citationId = requiredId(
          result,
          "citation_id",
          "Citation creation returned no identity.",
        );

        setCreatedCitationId(citationId);
      }

      await attachArticleVersionCitation({
        p_article_version_id:
          articleVersionId,
        p_citation_id: citationId,
        p_citation_purpose:
          citationPurpose,
        p_target_anchor_type:
          targetAnchorType,
        p_target_anchor_data:
          targetAnchorData,
        p_display_order:
          nextDisplayOrder,
        p_public_safe:
          attachmentPublicSafe,
        p_expected_citation_revision:
          expectedCitationRevision,
      });

      onAttached();
    } catch (error) {
      if (
        error instanceof
          ArticleTrustServiceError &&
        error.kind === "concurrency"
      ) {
        setErrorMessage(
          "The Citation revision changed while this form was open. Trust has been refreshed. Retry the attachment.",
        );
        onConcurrency();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The Citation could not be created and attached.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function field(
    label: string,
    value: string,
    setValue: (value: string) => void,
    options?: {
      type?: "text" | "number";
      min?: number;
      placeholder?: string;
      lockAfterCitation?: boolean;
    },
  ): ReactNode {
    const lockAfterCitation =
      options?.lockAfterCitation ?? true;

    return (
      <label>
        <span className="wk-label">
          {label}
        </span>
        <input
          type={options?.type ?? "text"}
          min={options?.min}
          value={value}
          onChange={(event) =>
            setValue(event.target.value)
          }
          disabled={
            submitting ||
            (
              lockAfterCitation &&
              citationLocked
            )
          }
          className="wk-input mt-1 w-full"
          placeholder={options?.placeholder}
        />
      </label>
    );
  }

  function renderLocatorFields(): ReactNode {
    switch (locatorType) {
      case "page":
        return field(
          "Page",
          page,
          setPage,
          {
            type: "number",
            min: 1,
          },
        );

      case "page_range":
        return (
          <>
            {field(
              "Start Page",
              startPage,
              setStartPage,
              {
                type: "number",
                min: 1,
              },
            )}
            {field(
              "End Page",
              endPage,
              setEndPage,
              {
                type: "number",
                min: 1,
              },
            )}
          </>
        );

      case "paragraph":
        return field(
          "Paragraph",
          paragraph,
          setParagraph,
          {
            type: "number",
            min: 1,
          },
        );

      case "quotation":
        return null;

      case "timestamp":
        return field(
          "Milliseconds",
          milliseconds,
          setMilliseconds,
          {
            type: "number",
            min: 0,
          },
        );

      case "timestamp_range":
      case "transcript_range":
        return (
          <>
            {field(
              "Start Milliseconds",
              startMilliseconds,
              setStartMilliseconds,
              {
                type: "number",
                min: 0,
              },
            )}
            {field(
              "End Milliseconds",
              endMilliseconds,
              setEndMilliseconds,
              {
                type: "number",
                min: 0,
              },
            )}
          </>
        );

      case "chapter":
        return field(
          "Chapter",
          chapter,
          setChapter,
        );

      case "image_frame":
        return field(
          "Frame",
          frame,
          setFrame,
          {
            type: "number",
            min: 0,
          },
        );

      case "spreadsheet_row":
        return (
          <>
            {field(
              "Sheet",
              sheet,
              setSheet,
            )}
            {field(
              "Row",
              row,
              setRow,
              {
                type: "number",
                min: 1,
              },
            )}
          </>
        );

      case "spreadsheet_cell":
        return (
          <>
            {field(
              "Sheet",
              sheet,
              setSheet,
            )}
            {field(
              "Cell",
              cell,
              setCell,
              {
                placeholder: "A1",
              },
            )}
          </>
        );

      case "archive_identifier":
        return field(
          "Archive Identifier",
          archiveIdentifier,
          setArchiveIdentifier,
        );

      case "section_heading":
        return field(
          "Section Heading",
          sectionHeading,
          setSectionHeading,
        );

      case "whole_source":
        return (
          <p className="rounded-lg bg-wk-bg-subtle px-3 py-2 text-[10px] leading-4 text-wk-text-muted sm:col-span-2">
            This Citation applies to the complete
            Source. No narrower locator is recorded.
          </p>
        );

      case "other":
        return field(
          "Locator Label",
          otherLocatorLabel,
          setOtherLocatorLabel,
        );

      default:
        return null;
    }
  }

  function renderAnchorFields(): ReactNode {
    switch (targetAnchorType) {
      case "whole_version":
        return (
          <p className="rounded-lg bg-wk-bg-subtle px-3 py-2 text-[10px] leading-4 text-wk-text-muted sm:col-span-2">
            This Citation applies to the complete
            working Article version.
          </p>
        );

      case "block_id":
        return field(
          "Block ID",
          blockId,
          setBlockId,
          {
            lockAfterCitation: false,
          },
        );

      case "heading_id":
        return field(
          "Heading ID",
          headingId,
          setHeadingId,
          {
            lockAfterCitation: false,
          },
        );

      case "paragraph_id":
        return field(
          "Paragraph ID",
          paragraphId,
          setParagraphId,
          {
            lockAfterCitation: false,
          },
        );

      case "character_range":
        return (
          <>
            {field(
              "Character Start",
              characterStart,
              setCharacterStart,
              {
                type: "number",
                min: 0,
                lockAfterCitation: false,
              },
            )}
            {field(
              "Character End",
              characterEnd,
              setCharacterEnd,
              {
                type: "number",
                min: 0,
                lockAfterCitation: false,
              },
            )}
          </>
        );

      case "structured_node":
        return field(
          "Structured Node ID",
          nodeId,
          setNodeId,
          {
            lockAfterCitation: false,
          },
        );

      default:
        return null;
    }
  }

  const submitLabel = createdCitationId
    ? "Attach Created Citation"
    : "Create and Attach Citation";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-citation-form-title"
    >
      <div className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-wk-border bg-wk-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
              Governed Citation
            </div>
            <h2
              id="article-citation-form-title"
              className="mt-1 text-[18px] font-bold text-wk-text"
            >
              Add a Citation
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-wk-text-muted">
              Create one immutable Citation from a
              reviewed Source version, then attach it
              to the current working Article version.
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            className="wk-button wk-button-ghost wk-button-sm shrink-0"
            aria-label="Close Citation form"
          >
            <WkIcon name="X" size={16} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {errorMessage ? (
              <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft px-4 py-3 text-[11px] leading-5 text-wk-danger">
                {errorMessage}
              </div>
            ) : null}

            {createdCitationId ? (
              <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3">
                <div className="text-[11px] font-bold text-wk-text">
                  Citation identity created
                </div>
                <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                  The immutable Citation already
                  exists. The form will reuse it and
                  retry only the Article attachment.
                </p>
              </div>
            ) : null}

            <fieldset
              disabled={
                citationLocked || submitting
              }
            >
              <legend className="text-[13px] font-bold text-wk-text">
                Source Version
              </legend>
              <p className="mt-1 text-[10px] text-wk-text-muted">
                Choose the exact active approved
                Source version this Citation points to.
              </p>

              <label className="mt-4 block">
                <span className="wk-label">
                  Source
                </span>
                <select
                  value={sourceId}
                  onChange={(event) =>
                    setSourceId(
                      event.target.value,
                    )
                  }
                  className="wk-input mt-1 w-full"
                >
                  {eligibleSources.map(
                    (source) => (
                      <option
                        key={source.id}
                        value={source.id}
                      >
                        {source.title}
                        {" · "}
                        {humanize(
                          source.exposureClass,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {selectedSource ? (
                <div className="mt-3 grid gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-[10px] sm:grid-cols-3">
                  <div>
                    <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Review
                    </div>
                    <div className="mt-1 text-wk-text">
                      {humanize(
                        selectedSource.reviewStatus,
                      )}
                      {" · "}
                      {humanize(
                        selectedSource.exposureClass,
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Source Version
                    </div>
                    <div className="mt-1 break-all font-mono text-wk-text">
                      {selectedSourceVersionId}
                    </div>
                  </div>

                  <div>
                    <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Public Reference
                    </div>
                    <div className="mt-1 text-wk-text">
                      {selectedSourcePublic
                        ? "Approved"
                        : "Internal only"}
                    </div>
                  </div>
                </div>
              ) : null}
            </fieldset>

            <fieldset
              disabled={
                citationLocked || submitting
              }
              className="border-t border-wk-border pt-5"
            >
              <legend className="text-[13px] font-bold text-wk-text">
                Citation Locator
              </legend>
              <p className="mt-1 text-[10px] text-wk-text-muted">
                Record where the evidence appears
                inside the selected Source.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Locator Type
                  </span>
                  <select
                    value={locatorType}
                    onChange={(event) =>
                      setLocatorType(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  >
                    {options.locatorTypes.map(
                      (option) => (
                        <option
                          key={
                            option.locatorType
                          }
                          value={
                            option.locatorType
                          }
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {renderLocatorFields()}

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Quotation
                  </span>
                  <textarea
                    value={quotation}
                    onChange={(event) =>
                      setQuotation(
                        event.target.value,
                      )
                    }
                    rows={3}
                    className="wk-input mt-1 w-full resize-y"
                    placeholder="Optional exact quotation. Required when Quotation is the locator type."
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Editor Note
                  </span>
                  <textarea
                    value={editorNote}
                    onChange={(event) =>
                      setEditorNote(
                        event.target.value,
                      )
                    }
                    rows={3}
                    className="wk-input mt-1 w-full resize-y"
                    placeholder="Private editorial context"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Public Label
                  </span>
                  <input
                    value={publicLabel}
                    onChange={(event) =>
                      setPublicLabel(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Optional public-facing Citation label"
                  />
                </label>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <input
                  type="checkbox"
                  checked={citationPublicSafe}
                  onChange={(event) =>
                    setCitationPublicSafe(
                      event.target.checked,
                    )
                  }
                  disabled={
                    !selectedSourcePublic ||
                    submitting
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[11px] font-bold text-wk-text">
                    Citation is Public-Safe
                  </span>
                  <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                    The exact approved Source version,
                    locator and Citation content may be
                    considered for public presentation.
                    Citation does not grant reuse
                    permission.
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="border-t border-wk-border pt-5">
              <legend className="text-[13px] font-bold text-wk-text">
                Article Attachment
              </legend>
              <p className="mt-1 text-[10px] text-wk-text-muted">
                Attach the Citation to the current
                working Article version. This advances
                only the Citation revision.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="wk-label">
                    Citation Purpose
                  </span>
                  <select
                    value={citationPurpose}
                    onChange={(event) =>
                      setCitationPurpose(
                        event.target.value,
                      )
                    }
                    disabled={submitting}
                    className="wk-input mt-1 w-full"
                  >
                    {options.citationPurposes.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="wk-label">
                    Display Order
                  </span>
                  <input
                    value={nextDisplayOrder}
                    readOnly
                    className="wk-input mt-1 w-full"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Article Target
                  </span>
                  <select
                    value={targetAnchorType}
                    onChange={(event) =>
                      setTargetAnchorType(
                        event.target.value,
                      )
                    }
                    disabled={submitting}
                    className="wk-input mt-1 w-full"
                  >
                    {options.targetAnchorTypes.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {renderAnchorFields()}
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <input
                  type="checkbox"
                  checked={
                    attachmentPublicSafe
                  }
                  onChange={(event) =>
                    setAttachmentPublicSafe(
                      event.target.checked,
                    )
                  }
                  disabled={
                    !citationPublicSafe ||
                    submitting
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[11px] font-bold text-wk-text">
                    Article Attachment is Public-Safe
                  </span>
                  <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                    This Article version may present
                    the Citation publicly when every
                    current Source, Citation and
                    attachment requirement remains
                    satisfied.
                  </span>
                </span>
              </label>
            </fieldset>

            {publicPresentation ? (
              <label className="flex items-start gap-3 rounded-xl border border-wk-success/30 bg-wk-success-soft p-4">
                <input
                  type="checkbox"
                  checked={
                    publicReviewConfirmed
                  }
                  onChange={(event) =>
                    setPublicReviewConfirmed(
                      event.target.checked,
                    )
                  }
                  disabled={submitting}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[11px] font-bold text-wk-text">
                    Confirm Public Citation Review
                  </span>
                  <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                    I reviewed the approved Source
                    version, locator, quotation, public
                    label and Article attachment for
                    public presentation.
                  </span>
                </span>
              </label>
            ) : null}

            {createdCitationId ? (
              <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                  Created Citation ID
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-wk-text">
                  {createdCitationId}
                </div>
              </section>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-wk-border px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="wk-button wk-button-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                eligibleSources.length === 0 ||
                options.locatorTypes.length === 0 ||
                options.citationPurposes.length === 0 ||
                options.targetAnchorTypes.length === 0
              }
              className="wk-button wk-button-primary"
            >
              <WkIcon
                name={
                  submitting
                    ? "Loader2"
                    : "Plus"
                }
                size={15}
                className={
                  submitting
                    ? "animate-spin"
                    : undefined
                }
              />
              {submitting
                ? "Saving Citation"
                : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

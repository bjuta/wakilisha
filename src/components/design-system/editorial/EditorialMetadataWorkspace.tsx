import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type {
  EditorialDiscoveryDraft,
  EditorialDiscoveryValue,
  EditorialTaxonomy,
  EditorialTaxonomyTerm,
} from "@/types/editorialDiscovery";

function draftFrom(value: EditorialDiscoveryValue): EditorialDiscoveryDraft {
  return {
    categories: value.categories,
    tags: value.tags,
    seo: {
      title: value.seo.title,
      description: value.seo.description,
      keywords: value.seo.keywords,
      focusKeyword: value.seo.focusKeyword,
    },
  };
}

function TaxonomyPicker({
  taxonomy,
  label,
  selected,
  disabled,
  onSearch,
  onCreate,
  onChange,
}: {
  taxonomy: EditorialTaxonomy;
  label: string;
  selected: EditorialTaxonomyTerm[];
  disabled: boolean;
  onSearch: (
    taxonomy: EditorialTaxonomy,
    query: string,
  ) => Promise<EditorialTaxonomyTerm[]>;
  onCreate?: (
    taxonomy: EditorialTaxonomy,
    name: string,
  ) => Promise<EditorialTaxonomyTerm>;
  onChange: (next: EditorialTaxonomyTerm[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EditorialTaxonomyTerm[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    let alive = true;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      setError(null);
      onSearch(taxonomy, query)
        .then((rows) => {
          if (alive) setResults(rows);
        })
        .catch((reason) => {
          if (!alive) return;
          setResults([]);
          setError(
            reason instanceof Error
              ? reason.message
              : `${label} could not load.`,
          );
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 220);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [label, onSearch, query, taxonomy]);

  const visibleResults = results.filter(
    (candidate) => !selected.some((item) => item.id === candidate.id),
  );
  const exactMatch = results.some(
    (candidate) =>
      candidate.name.toLowerCase() === query.trim().toLowerCase(),
  );

  async function createTerm() {
    if (!onCreate || !query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const created = await onCreate(taxonomy, query.trim());
      if (!selected.some((item) => item.id === created.id)) {
        onChange([...selected, created]);
      }
      setQuery("");
      setResults([]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `${label} could not be created.`,
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <div className="mb-2 text-xs font-black text-wk-text">{label}</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {selected.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand"
          >
            {item.name}
            {!disabled ? (
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() =>
                  onChange(selected.filter((candidate) => candidate.id !== item.id))
                }
                className="rounded-full p-0.5 hover:bg-wk-brand/10"
              >
                <WkIcon name="X" size={10} />
              </button>
            ) : null}
          </span>
        ))}
        {!selected.length ? (
          <span className="text-[11px] text-wk-text-faint">None selected</span>
        ) : null}
      </div>

      {!disabled ? (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
            <WkIcon name="Search" size={13} className="text-wk-text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label}`}
              className="min-w-0 flex-1 bg-transparent text-xs text-wk-text outline-none placeholder:text-wk-text-faint"
            />
            {searching ? (
              <WkIcon
                name="LoaderCircle"
                size={12}
                className="animate-spin text-wk-text-faint"
              />
            ) : null}
          </div>

          {query.trim() && (visibleResults.length > 0 || (onCreate && !exactMatch)) ? (
            <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-wk-border bg-wk-surface p-1.5 shadow-xl">
              {visibleResults.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => {
                    onChange([...selected, candidate]);
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-wk-surface-raised"
                >
                  <span className="font-bold text-wk-text">{candidate.name}</span>
                  <span className="font-mono text-[10px] text-wk-text-faint">
                    {candidate.slug}
                  </span>
                </button>
              ))}

              {onCreate && !exactMatch ? (
                <button
                  type="button"
                  onClick={() => void createTerm()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-wk-brand hover:bg-wk-brand-soft"
                >
                  <WkIcon name="Plus" size={12} />
                  Create {query.trim()}
                </button>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mt-1 text-[11px] text-wk-danger">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function EditorialMetadataWorkspace({
  value,
  disabled = false,
  saving = false,
  onSearchTerms,
  onCreateTerm,
  onSave,
}: {
  value: EditorialDiscoveryValue;
  disabled?: boolean;
  saving?: boolean;
  onSearchTerms: (
    taxonomy: EditorialTaxonomy,
    query: string,
  ) => Promise<EditorialTaxonomyTerm[]>;
  onCreateTerm?: (
    taxonomy: EditorialTaxonomy,
    name: string,
  ) => Promise<EditorialTaxonomyTerm>;
  onSave: (draft: EditorialDiscoveryDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EditorialDiscoveryDraft>(() =>
    draftFrom(value),
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(draftFrom(value));
    setMessage(null);
  }, [value]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(draftFrom(value)),
    [draft, value],
  );

  async function save() {
    setMessage(null);
    try {
      await onSave(draft);
      setMessage("Discovery saved.");
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Discovery could not be saved.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-black text-wk-text">Discovery</h2>
        <p className="mt-1 text-xs leading-5 text-wk-text-muted">
          Categories, Tags, and search details travel with this exact editorial version.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TaxonomyPicker
          taxonomy="category"
          label="Categories"
          selected={draft.categories}
          disabled={disabled || saving}
          onSearch={onSearchTerms}
          onCreate={onCreateTerm}
          onChange={(categories) =>
            setDraft((current) => ({ ...current, categories }))
          }
        />
        <TaxonomyPicker
          taxonomy="post_tag"
          label="Tags"
          selected={draft.tags}
          disabled={disabled || saving}
          onSearch={onSearchTerms}
          onCreate={onCreateTerm}
          onChange={(tags) =>
            setDraft((current) => ({ ...current, tags }))
          }
        />
      </div>

      <div className="grid gap-4 border-t border-wk-border pt-5 lg:grid-cols-2">
        <label className="block text-xs font-bold text-wk-text-muted">
          Search Title
          <input
            value={draft.seo.title}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                seo: { ...current.seo, title: event.target.value },
              }))
            }
            disabled={disabled || saving}
            maxLength={180}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
          />
        </label>

        <label className="block text-xs font-bold text-wk-text-muted">
          Focus Keyword
          <input
            value={draft.seo.focusKeyword}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                seo: { ...current.seo, focusKeyword: event.target.value },
              }))
            }
            disabled={disabled || saving}
            maxLength={160}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
          />
        </label>

        <label className="block text-xs font-bold text-wk-text-muted lg:col-span-2">
          Search Description
          <textarea
            value={draft.seo.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                seo: { ...current.seo, description: event.target.value },
              }))
            }
            disabled={disabled || saving}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
          />
        </label>

        <label className="block text-xs font-bold text-wk-text-muted lg:col-span-2">
          Search Keywords
          <input
            value={draft.seo.keywords.join(", ")}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                seo: {
                  ...current.seo,
                  keywords: event.target.value
                    .split(",")
                    .map((keyword) => keyword.trim()),
                },
              }))
            }
            disabled={disabled || saving}
            placeholder="culture, Nairobi, music"
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
          />
          <span className="mt-1 block text-[10px] text-wk-text-faint">
            Separate keywords with commas.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-wk-border pt-4">
        {!disabled ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
          >
            {saving ? (
              <WkIcon name="LoaderCircle" size={13} className="animate-spin" />
            ) : (
              <WkIcon name="Save" size={13} />
            )}
            Save Discovery
          </button>
        ) : null}
        <span className="text-[10px] text-wk-text-faint">
          Revision {value.metadataRevision}
        </span>
        {message ? (
          <span className="text-[11px] font-semibold text-wk-text-muted">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

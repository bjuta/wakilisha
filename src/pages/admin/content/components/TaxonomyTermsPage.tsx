import { useState, useEffect, useCallback, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";
import type { WkIconName } from "@/components/design-system/Icon";

interface TaxonomyTerm {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  source_kind: string | null;
  created_at: string;
  updated_at: string;
  total_count: number;
  article_count?: number;
}

interface TaxonomyTermsPageProps {
  title: string;
  subtitle: string;
  taxonomy: string;
  icon: WkIconName;
}

const PAGE_SIZE = 25;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function TaxonomyTermsPage({ title, subtitle, taxonomy, icon }: TaxonomyTermsPageProps) {
  /* ─── Data state ─── */
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [articleCounts, setArticleCounts] = useState<Map<string, number>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Selection state ─── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  /* ─── Form state ─── */
  const [showForm, setShowForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TaxonomyTerm | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSeoTitle, setFormSeoTitle] = useState("");
  const [formSeoDescription, setFormSeoDescription] = useState("");
  const [formSeoKeywords, setFormSeoKeywords] = useState("");
  const [formAutoSlug, setFormAutoSlug] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formShowSeo, setFormShowSeo] = useState(false);

  /* ─── Delete state ─── */
  const [showDelete, setShowDelete] = useState<TaxonomyTerm | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  /* ─── Load article counts ─── */
  useEffect(() => {
    supabase
      .rpc("get_taxonomy_article_counts", { p_taxonomy: taxonomy })
      .then(({ data }) => {
        if (data) {
          const map = new Map<string, number>();
          for (const row of data as { term_name: string; article_count: number }[]) {
            map.set(row.term_name, row.article_count);
          }
          setArticleCounts(map);
        }
      });
  }, [taxonomy]);

  /* ─── Load terms ─── */
  const loadTerms = useCallback(async (p: number, q: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_taxonomy_terms", {
      p_taxonomy: taxonomy,
      p_search: q || null,
      p_page: p,
      p_page_size: PAGE_SIZE,
    });

    if (error) {
      console.error(`Error loading ${taxonomy}:`, error);
      setTerms([]);
      setTotalCount(0);
    } else if (data && data.length > 0) {
      const raw = data as TaxonomyTerm[];
      setTotalCount(raw[0].total_count);
      setTerms(
        raw.map((t) => ({
          ...t,
          article_count: articleCounts.get(t.name) ?? 0,
        }))
      );
    } else {
      setTerms([]);
      setTotalCount(0);
    }
    setLoading(false);
  }, [taxonomy, articleCounts]);

  useEffect(() => {
    loadTerms(page, search);
  }, [page, search, loadTerms]);

  /* ─── Search with debounce ─── */
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
      setSelected(new Set());
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }, []);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setPage(clamped);
    setSelected(new Set());
  }, [totalPages]);

  /* ─── Selection ─── */
  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === terms.length && terms.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(terms.map((t) => t.id)));
    }
  }, [selected.size, terms]);

  const handleRowClick = useCallback((term: TaxonomyTerm, e: React.MouseEvent) => {
    if (selected.size > 0) {
      toggleSelect(term.id, e);
    } else {
      openEdit(term);
    }
  }, [selected.size, toggleSelect]);

  /* ─── Form ─── */
  const openCreate = useCallback(() => {
    setEditingTerm(null);
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormSeoTitle("");
    setFormSeoDescription("");
    setFormSeoKeywords("");
    setFormAutoSlug(true);
    setFormShowSeo(false);
    setFormError(null);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((term: TaxonomyTerm) => {
    setEditingTerm(term);
    setFormName(term.name);
    setFormSlug(term.slug);
    setFormDescription(term.description ?? "");
    setFormSeoTitle(term.seo_title ?? "");
    setFormSeoDescription(term.seo_description ?? "");
    setFormSeoKeywords(term.seo_keywords ?? "");
    setFormAutoSlug(false);
    setFormShowSeo(!!(term.seo_title || term.seo_description || term.seo_keywords));
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleNameChange = useCallback(
    (value: string) => {
      setFormName(value);
      if (formAutoSlug) setFormSlug(slugify(value));
    },
    [formAutoSlug]
  );

  const handleSlugChange = useCallback((value: string) => {
    setFormAutoSlug(false);
    setFormSlug(slugify(value));
  }, []);

  const handleSubmit = useCallback(async () => {
    const name = formName.trim();
    const slug = formSlug.trim() || slugify(formName).trim();
    const description = formDescription.trim() || null;
    const seoTitle = formSeoTitle.trim() || null;
    const seoDescription = formSeoDescription.trim() || null;
    const seoKeywords = formSeoKeywords.trim() || null;

    if (!name) { setFormError("Please enter a name."); return; }
    if (!slug) { setFormError("Please enter a slug."); return; }

    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingTerm) {
        const { error: rpcError } = await supabase.rpc("update_taxonomy_term", {
          p_term_id: editingTerm.id,
          p_name: name,
          p_slug: slug,
          p_description: description,
          p_seo_title: seoTitle,
          p_seo_description: seoDescription,
          p_seo_keywords: seoKeywords,
        });

        if (rpcError) { setFormError(`Failed to update: ${rpcError.message}`); setFormSubmitting(false); return; }

        setTerms((prev) =>
          prev.map((t) =>
            t.id === editingTerm.id
              ? { ...t, name, slug, description, seo_title: seoTitle, seo_description: seoDescription, seo_keywords: seoKeywords, updated_at: new Date().toISOString() }
              : t
          )
        );
      } else {
        const { data: result, error: rpcError } = await supabase.rpc("create_taxonomy_term", {
          p_taxonomy: taxonomy,
          p_slug: slug,
          p_name: name,
          p_description: description,
          p_seo_title: seoTitle,
          p_seo_description: seoDescription,
          p_seo_keywords: seoKeywords,
        });

        if (rpcError) { setFormError(`Failed to create: ${rpcError.message}`); setFormSubmitting(false); return; }

        const newTerm = (result ?? [])[0] as TaxonomyTerm | undefined;
        if (newTerm) {
          loadTerms(page, search);
        }
      }

      setShowForm(false);
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setFormSubmitting(false);
    }
  }, [editingTerm, formName, formSlug, formDescription, formSeoTitle, formSeoDescription, formSeoKeywords, taxonomy, page, search, loadTerms]);

  /* ─── Single delete ─── */
  const handleDelete = useCallback(async () => {
    if (!showDelete) return;
    setDeleteSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc("bulk_delete_taxonomy_terms", {
        p_term_ids: [showDelete.id],
      });
      if (rpcError) { alert(`Failed to delete: ${rpcError.message}`); setDeleteSubmitting(false); return; }
      setTerms((prev) => prev.filter((t) => t.id !== showDelete.id));
      setTotalCount((c) => c - 1);
      setShowDelete(null);
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [showDelete]);

  /* ─── Bulk delete ─── */
  const handleBulkDelete = useCallback(async () => {
    setDeleteSubmitting(true);
    try {
      const ids = Array.from(selected);
      const { error: rpcError } = await supabase.rpc("bulk_delete_taxonomy_terms", {
        p_term_ids: ids,
      });
      if (rpcError) { alert(`Failed to delete: ${rpcError.message}`); setDeleteSubmitting(false); return; }
      setSelected(new Set());
      setShowBulkDelete(false);
      loadTerms(page, search);
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [selected, page, search, loadTerms]);

  const allOnPageSelected = terms.length > 0 && selected.size === terms.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Content</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center">
              <WkIcon name={icon} size={20} />
            </span>
            {title}
          </h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Plus" size={14} />
            Add {title}
          </button>
        </div>
      </div>

      {/* Filter bar + bulk actions */}
      <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 flex-1 max-w-md">
              <WkIcon name="Search" size={14} className="text-wk-text-faint" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
              />
              {searchInput && (
                <button onClick={clearSearch} className="text-wk-text-faint hover:text-wk-text cursor-pointer">
                  <WkIcon name="X" size={14} />
                </button>
              )}
            </div>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">
              {totalCount} total
            </span>
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-wk-brand-soft border border-wk-brand/20 px-4 py-3">
            <span className="text-[13px] font-semibold text-wk-brand">
              {selected.size} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setShowBulkDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-wk-danger/30 bg-wk-danger-soft px-3 py-1.5 text-[12px] font-semibold text-wk-danger hover:bg-wk-danger hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="Trash2" size={13} />
              Delete Selected
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="X" size={13} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="h-4 w-48 rounded bg-wk-surface-raised mb-2" />
              <div className="h-3 w-32 rounded bg-wk-surface-raised" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="wk-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--wk-border)]">
                    <th className="pl-4 pr-2 py-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors cursor-pointer ${
                          allOnPageSelected
                            ? "bg-wk-brand border-wk-brand text-white"
                            : "border-wk-border bg-wk-surface hover:border-wk-brand"
                        }`}
                      >
                        {allOnPageSelected && (
                          <WkIcon name="Check" size={10} />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] w-[80px]">
                      Articles
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] hidden md:table-cell">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] hidden lg:table-cell w-[80px]">
                      SEO
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] w-[80px]">
                      Source
                    </th>
                    <th className="px-4 py-3 w-[80px]" />
                  </tr>
                </thead>
                <tbody>
                  {terms.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-[var(--wk-text-muted)]">
                        {search ? `No ${title.toLowerCase()} match "${search}"` : `No ${title.toLowerCase()} found.`}
                      </td>
                    </tr>
                  ) : (
                    terms.map((term, i) => {
                      const isSelected = selected.has(term.id);
                      const hasSeo = !!(term.seo_title || term.seo_description || term.seo_keywords);
                      return (
                        <tr
                          key={term.id}
                          onClick={(e) => handleRowClick(term, e)}
                          className={`border-b border-[var(--wk-divider)] transition-colors cursor-pointer hover:bg-[var(--wk-surface-raised)] ${
                            i === terms.length - 1 ? "border-b-0" : ""
                          } ${isSelected ? "bg-wk-brand-soft/50" : ""}`}
                        >
                          <td className="pl-4 pr-2 py-3">
                            <button
                              onClick={(e) => toggleSelect(term.id, e)}
                              className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-wk-brand border-wk-brand text-white"
                                  : "border-wk-border bg-wk-surface hover:border-wk-brand"
                              }`}
                            >
                              {isSelected && <WkIcon name="Check" size={10} />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[13px] font-semibold text-wk-text">{term.name}</div>
                            <div className="text-[11px] text-wk-text-muted font-mono">{term.slug}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                              (term.article_count ?? 0) > 0
                                ? "bg-wk-brand-soft text-wk-brand"
                                : "bg-wk-bg-subtle text-wk-text-faint"
                            }`}>
                              {term.article_count ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-[12px] text-wk-text-muted line-clamp-2 max-w-[300px]">
                              {term.description || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {hasSeo ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-wk-info-soft px-2 py-0.5 text-[11px] font-semibold text-wk-info" title={[term.seo_title, term.seo_description, term.seo_keywords].filter(Boolean).join(" · ")}>
                                <WkIcon name="Search" size={10} />
                                Set
                              </span>
                            ) : (
                              <span className="text-[11px] text-wk-text-faint">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {term.source_kind && term.source_kind !== "editor_ui" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-wk-surface-raised border border-wk-border px-2 py-0.5 text-[10px] font-semibold text-wk-text-muted capitalize whitespace-nowrap">
                                <WkIcon name="Globe" size={9} />
                                {term.source_kind.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-wk-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-wk-text-faint whitespace-nowrap">
                                <WkIcon name="Pencil" size={9} />
                                Manual
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEdit(term); }}
                                className="h-7 w-7 rounded-md border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand transition-all cursor-pointer"
                                title="Edit"
                              >
                                <WkIcon name="Pencil" size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowDelete(term); }}
                                className="h-7 w-7 rounded-md border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-danger hover:border-wk-danger transition-all cursor-pointer"
                                title="Delete"
                              >
                                <WkIcon name="Trash2" size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-wk-border bg-wk-surface p-4">
              <span className="text-[12px] text-wk-text-muted">
                Page {page} of {totalPages} · {totalCount} {title.toLowerCase()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={page === 1}
                  className="h-8 w-8 rounded-lg border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="First page"
                >
                  <WkIcon name="ChevronsLeft" size={14} />
                </button>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="h-8 w-8 rounded-lg border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Previous page"
                >
                  <WkIcon name="ChevronLeft" size={14} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - page) <= 2) return true;
                    return false;
                  })
                  .map((p, idx, arr) => {
                    const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-1 text-[12px] text-wk-text-faint">…</span>
                        )}
                        <button
                          onClick={() => goToPage(p)}
                          className={`h-8 min-w-[2rem] rounded-lg px-2 text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            p === page
                              ? "bg-wk-brand text-white"
                              : "border border-wk-border bg-wk-surface text-wk-text-muted hover:text-wk-text hover:border-wk-brand"
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}

                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  className="h-8 w-8 rounded-lg border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Next page"
                >
                  <WkIcon name="ChevronRight" size={14} />
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={page === totalPages}
                  className="h-8 w-8 rounded-lg border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Last page"
                >
                  <WkIcon name="ChevronsRight" size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit/Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] overflow-y-auto">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-wk-border bg-wk-surface shadow-lg mb-10">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-wk-border">
              <h3 className="text-[16px] font-bold text-wk-text">
                {editingTerm ? `Edit ${title}` : `Add ${title}`}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="h-8 w-8 rounded-lg border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand transition-all cursor-pointer"
              >
                <WkIcon name="X" size={14} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <label className="block text-[12px] font-black uppercase tracking-wider text-wk-text-muted">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={`Enter ${title.toLowerCase()} name...`}
                  className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[14px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
                  autoFocus
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <label className="block text-[12px] font-black uppercase tracking-wider text-wk-text-muted">
                  Slug
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder={`${title.toLowerCase()}-slug`}
                    className="flex-1 rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[13px] font-mono text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
                  />
                  <button
                    onClick={() => { setFormAutoSlug(true); setFormSlug(slugify(formName)); }}
                    className="h-10 w-10 rounded-lg border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand transition-all cursor-pointer shrink-0"
                    title="Regenerate from name"
                  >
                    <WkIcon name="RefreshCw" size={14} />
                  </button>
                </div>
                {formAutoSlug && formName && (
                  <p className="text-[11px] text-wk-text-faint">Auto-generated from name.</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-[12px] font-black uppercase tracking-wider text-wk-text-muted">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[14px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors resize-none"
                />
                <p className="text-[11px] text-wk-text-faint">
                  {formDescription.length}/500 characters
                </p>
              </div>

              {/* SEO Toggle */}
              <div>
                <button
                  onClick={() => setFormShowSeo(!formShowSeo)}
                  className="flex w-full items-center justify-between rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[13px] font-semibold text-wk-text-muted hover:text-wk-text hover:border-wk-brand transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <WkIcon name="Search" size={14} className="text-wk-text-faint" />
                    SEO Metadata
                    {(formSeoTitle || formSeoDescription || formSeoKeywords) && (
                      <span className="inline-flex items-center rounded-full bg-wk-info-soft px-2 py-0.5 text-[10px] font-semibold text-wk-info">
                        Set
                      </span>
                    )}
                  </span>
                  <WkIcon name={formShowSeo ? "ChevronUp" : "ChevronDown"} size={14} className="text-wk-text-faint" />
                </button>

                {formShowSeo && (
                  <div className="mt-3 space-y-3 pl-1">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-wk-text-muted">
                        SEO Title
                      </label>
                      <input
                        type="text"
                        value={formSeoTitle}
                        onChange={(e) => setFormSeoTitle(e.target.value)}
                        placeholder="Custom SEO title (60 chars max)"
                        maxLength={60}
                        className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
                      />
                      <p className="text-right text-[10px] text-wk-text-faint">{formSeoTitle.length}/60</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-wk-text-muted">
                        Meta Description
                      </label>
                      <textarea
                        value={formSeoDescription}
                        onChange={(e) => setFormSeoDescription(e.target.value)}
                        placeholder="Custom meta description (160 chars max)"
                        rows={2}
                        maxLength={160}
                        className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors resize-none"
                      />
                      <p className="text-right text-[10px] text-wk-text-faint">{formSeoDescription.length}/160</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-wk-text-muted">
                        Keywords
                      </label>
                      <input
                        type="text"
                        value={formSeoKeywords}
                        onChange={(e) => setFormSeoKeywords(e.target.value)}
                        placeholder="keyw ord1, keyword2, keyword3"
                        className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {formError && (
                <div className="flex items-start gap-2 rounded-lg bg-wk-danger-soft border border-wk-danger/20 px-4 py-3 text-[13px] text-wk-danger">
                  <WkIcon name="AlertCircle" size={15} className="shrink-0 mt-px" />
                  {formError}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 px-6 pb-6 pt-2">
              <button
                onClick={handleSubmit}
                disabled={formSubmitting || !formName.trim()}
                className="wk-button wk-button-primary wk-button-sm flex-1 whitespace-nowrap"
              >
                {formSubmitting ? (
                  <>
                    <WkIcon name="Loader2" size={14} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <WkIcon name="Save" size={14} />
                    {editingTerm ? "Save Changes" : "Create"}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
              <WkIcon name="Trash2" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">
              Delete {title}?
            </h3>
            <p className="text-[13px] text-wk-text-muted mb-5">
              Are you sure you want to delete &quot;{showDelete.name}&quot;? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(null)}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="wk-button wk-button-sm flex-1 whitespace-nowrap bg-wk-danger text-white hover:opacity-90 border border-wk-danger"
              >
                {deleteSubmitting ? (
                  <>
                    <WkIcon name="Loader2" size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
              <WkIcon name="Trash2" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">
              Delete {selected.size} {title}?
            </h3>
            <p className="text-[13px] text-wk-text-muted mb-5">
              Are you sure you want to permanently delete {selected.size} {title.toLowerCase()}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDelete(false)}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleteSubmitting}
                className="wk-button wk-button-sm flex-1 whitespace-nowrap bg-wk-danger text-white hover:opacity-90 border border-wk-danger"
              >
                {deleteSubmitting ? (
                  <>
                    <WkIcon name="Loader2" size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  `Delete ${selected.size}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
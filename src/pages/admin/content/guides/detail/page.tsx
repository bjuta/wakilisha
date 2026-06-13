import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkButton } from "@/components/design-system/primitives/Button";
import { fetchGuideForAdmin, updateGuidePage, publishGuide, unpublishGuide } from "@/services/guidePages";
import type { GuidePageRecord, GuideSection } from "@/pages/guides/detail/sectionTypes";
import GuideEditorHeader from "./components/GuideEditorHeader";
import SectionCard from "./components/SectionCard";
import AddSectionDrawer from "./components/AddSectionDrawer";
import LivePreviewPanel from "./components/LivePreviewPanel";

/* ─── Toast ─── */

interface ToastMsg {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

let toastCounter = 0;

export default function AdminGuideDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // ── State ──
  const [guide, setGuide] = useState<GuidePageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0])); // First section expanded by default

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  /* ─── Load guide ─── */
  useEffect(() => {
    if (!slug) return;

    let alive = true;
    setLoading(true);

    fetchGuideForAdmin(slug)
      .then((data) => {
        if (!alive) return;
        if (!data) {
          setNotFound(true);
        } else {
          setGuide(data);
          // Expand first section by default
          if (data.sections.length > 0) {
            setExpandedSections(new Set([0]));
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setNotFound(true);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [slug]);

  /* ─── Toast helpers ─── */
  const addToast = useCallback((type: ToastMsg["type"], message: string) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  /* ─── Guide field mutations ─── */
  const patchGuide = useCallback((patch: Partial<GuidePageRecord>) => {
    setGuide((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
    setIsDirty(true);
  }, []);

  const handleTitleChange = useCallback((v: string) => patchGuide({ title: v }), [patchGuide]);
  const handleSubtitleChange = useCallback((v: string) => patchGuide({ subtitle: v }), [patchGuide]);
  const handleFormatChange = useCallback((v: string) => patchGuide({ guide_format: v }), [patchGuide]);

  /* ─── Section CRUD ─── */

  const handleAddSection = useCallback((section: GuideSection) => {
    setGuide((prev) => {
      if (!prev) return prev;
      const newSections = [...prev.sections, section];
      return { ...prev, sections: newSections };
    });
    setIsDirty(true);
    // Expand the new section
    setGuide((prev) => {
      if (!prev) return prev;
      const idx = prev.sections.length;
      setExpandedSections((prevSet) => {
        const next = new Set(prevSet);
        next.add(idx);
        return next;
      });
      return prev;
    });
  }, []);

  const handleUpdateSection = useCallback((index: number, data: Record<string, unknown>) => {
    setGuide((prev) => {
      if (!prev) return prev;
      const newSections = [...prev.sections];
      // If _title is in data, update the section title
      const { _title, ...rest } = data as any;
      newSections[index] = {
        ...newSections[index],
        data: rest,
        title: _title !== undefined ? _title : newSections[index].title,
      };
      return { ...prev, sections: newSections };
    });
    setIsDirty(true);
  }, []);

  const handleDeleteSection = useCallback((index: number) => {
    setGuide((prev) => {
      if (!prev) return prev;
      const newSections = prev.sections.filter((_, i) => i !== index);
      return { ...prev, sections: newSections };
    });
    setIsDirty(true);
    setExpandedSections((prevSet) => {
      const next = new Set(prevSet);
      next.delete(index);
      // Re-index remaining expanded items
      const reindexed = new Set<number>();
      next.forEach((i) => {
        if (i > index) reindexed.add(i - 1);
        else reindexed.add(i);
      });
      return reindexed;
    });
  }, []);

  const handleToggleExpand = useCallback((index: number) => {
    setExpandedSections((prevSet) => {
      const next = new Set(prevSet);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  /* ─── Drag and Drop ─── */

  const handleDragStart = useCallback((_e: React.DragEvent, index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (_e: React.DragEvent, dropIndex: number) => {
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }

      setGuide((prev) => {
        if (!prev) return prev;
        const newSections = [...prev.sections];
        const [moved] = newSections.splice(dragIndex, 1);
        newSections.splice(dropIndex, 0, moved);
        return { ...prev, sections: newSections };
      });
      setIsDirty(true);

      // Update expanded sections tracking
      setExpandedSections((prevSet) => {
        const next = new Set<number>();
        prevSet.forEach((i) => {
          if (i === dragIndex) {
            next.add(dropIndex);
          } else if (dragIndex < dropIndex) {
            if (i > dragIndex && i <= dropIndex) next.add(i - 1);
            else next.add(i);
          } else {
            if (i >= dropIndex && i < dragIndex) next.add(i + 1);
            else next.add(i);
          }
        });
        return next;
      });

      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex]
  );

  /* ─── Save ─── */

  const handleSave = useCallback(async () => {
    if (!guide || !isDirty) return;
    setIsSaving(true);
    const ok = await updateGuidePage(guide.slug, {
      title: guide.title,
      subtitle: guide.subtitle,
      excerpt: guide.excerpt,
      sections: guide.sections,
      guide_format: guide.guide_format,
      color_var: guide.color_var,
      icon: guide.icon,
      framing: guide.framing,
      hero_url: guide.hero_url,
    });
    setIsSaving(false);
    if (ok) {
      setIsDirty(false);
      addToast("success", "Guide saved.");
    } else {
      addToast("error", "Failed to save guide.");
    }
  }, [guide, isDirty, addToast]);

  const handlePublish = useCallback(async () => {
    if (!guide) return;
    // Save first if dirty
    if (isDirty) {
      setIsSaving(true);
      const saved = await updateGuidePage(guide.slug, {
        title: guide.title,
        subtitle: guide.subtitle,
        excerpt: guide.excerpt,
        sections: guide.sections,
        guide_format: guide.guide_format,
        color_var: guide.color_var,
        icon: guide.icon,
        framing: guide.framing,
        hero_url: guide.hero_url,
      });
      setIsSaving(false);
      if (!saved) {
        addToast("error", "Failed to save before publishing.");
        return;
      }
      setIsDirty(false);
    }

    setIsPublishing(true);
    const ok = await publishGuide(guide.slug);
    setIsPublishing(false);
    if (ok) {
      setGuide((prev) => (prev ? { ...prev, status: "published" } : prev));
      addToast("success", "Guide published!");
    } else {
      addToast("error", "Failed to publish guide.");
    }
  }, [guide, isDirty, addToast]);

  const handleUnpublish = useCallback(async () => {
    if (!guide) return;
    setIsPublishing(true);
    const ok = await unpublishGuide(guide.slug);
    setIsPublishing(false);
    if (ok) {
      setGuide((prev) => (prev ? { ...prev, status: "draft" } : prev));
      addToast("info", "Guide unpublished — now a draft.");
    } else {
      addToast("error", "Failed to unpublish guide.");
    }
  }, [guide, addToast]);

  /* ─── Keyboard shortcut ─── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  /* ─── Unsaved changes warning ─── */
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  /* ─── Render states ─── */

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 w-72 rounded-xl bg-[var(--wk-surface-raised)]" />
        <div className="h-[500px] rounded-xl bg-[var(--wk-surface-raised)]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]">
          <WkIcon name="FileX" size={28} />
        </div>
        <h2 className="text-[18px] font-bold text-[var(--wk-text)]">Guide Not Found</h2>
        <p className="text-[13px] text-[var(--wk-text-muted)]">No guide with slug &quot;{slug}&quot;</p>
        <WkButton variant="secondary" onClick={() => navigate("/admin/content/guides")}>
          <WkIcon name="ArrowLeft" size={14} />
          Back to Guides
        </WkButton>
      </div>
    );
  }

  if (!guide) return null;

  const sections = guide.sections || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <GuideEditorHeader
        guide={guide}
        isDirty={isDirty}
        isSaving={isSaving}
        isPublishing={isPublishing}
        onTitleChange={handleTitleChange}
        onSubtitleChange={handleSubtitleChange}
        onFormatChange={handleFormatChange}
        onSave={handleSave}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onBack={() => navigate("/admin/content/guides")}
      />

      {/* Keyboard hint */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
        <span className="inline-flex items-center rounded-md bg-[var(--wk-bg-subtle)] px-1.5 py-0.5 text-[10px] font-mono border border-[var(--wk-border)]">
          ⌘S
        </span>
        <span>to save</span>
        {isDirty && (
          <span className="text-[var(--wk-warning)] font-semibold ml-1">— Unsaved changes</span>
        )}
      </div>

      {/* Main layout: sections left, preview right */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Sections list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[var(--wk-text)] uppercase tracking-wider">
              Sections ({sections.length})
            </h3>
            <button
              onClick={() => setShowAddDrawer(true)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--wk-info)] hover:underline cursor-pointer"
            >
              <WkIcon name="Plus" size={13} />
              Add Section
            </button>
          </div>

          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-surface)] text-[var(--wk-text-faint)] mb-3 border border-[var(--wk-divider)]">
                <WkIcon name="Layers" size={20} />
              </div>
              <p className="text-[13px] font-semibold text-[var(--wk-text-muted)]">No sections yet</p>
              <p className="text-[11px] text-[var(--wk-text-faint)] mt-1 mb-4 max-w-[280px]">
                Start building your guide by adding sections. Drag to reorder, click to expand and edit.
              </p>
              <WkButton variant="primary" size="sm" onClick={() => setShowAddDrawer(true)}>
                <WkIcon name="Plus" size={14} />
                Add Your First Section
              </WkButton>
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section, index) => (
                <SectionCard
                  key={`${section.key}-${index}`}
                  section={section}
                  index={index}
                  isExpanded={expandedSections.has(index)}
                  onToggleExpand={() => handleToggleExpand(index)}
                  onUpdate={(data) => handleUpdateSection(index, data)}
                  onDelete={() => handleDeleteSection(index)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                />
              ))}

              {/* Add section button at bottom */}
              <button
                onClick={() => setShowAddDrawer(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)]/30 hover:text-[var(--wk-brand)] transition-colors cursor-pointer"
              >
                <WkIcon name="Plus" size={14} />
                <span className="text-[12px] font-semibold">Add Section</span>
              </button>
            </div>
          )}
        </div>

        {/* Live preview panel */}
        <LivePreviewPanel sections={sections} />
      </div>

      {/* Add Section Drawer */}
      <AddSectionDrawer
        isOpen={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onAdd={handleAddSection}
        existingCount={sections.length}
      />

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
              toast.type === "success"
                ? "border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                : toast.type === "error"
                  ? "border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                  : "border-[var(--wk-info)]/20 bg-[var(--wk-info-soft)] text-[var(--wk-info)]"
            }`}
          >
            <WkIcon
              name={toast.type === "success" ? "CheckCircle2" : toast.type === "error" ? "XCircle" : "Info"}
              size={16}
            />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
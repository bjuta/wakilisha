import { useEffect, useState, useCallback, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";

interface MediaAssetRow {
  id: string;
  entity_type: string;
  entity_slug: string;
  role: string;
  url: string;
  alt_text: string | null;
  source: string;
}

interface BucketItem {
  name: string;
  id: string | null;
  path: string;
  isFolder: boolean;
  publicUrl?: string;
}

type Tab = "assets" | "migrated" | "upload";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  title?: string;
}

export function MediaPickerModal({ open, onClose, onSelect, title = "Select Media" }: Props) {
  const [tab, setTab] = useState<Tab>("assets");
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");

  const [storageRoot, setStorageRoot] = useState<"wp-import" | "uploads">("wp-import");
  const [bucketPath, setBucketPath] = useState("wp-import");
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);
  const [bucketLoading, setBucketLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [previewError, setPreviewError] = useState(false);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, "pending" | "uploading" | "done" | "error">>({});
  const [uploadedUrls, setUploadedUrls] = useState<{ name: string; url: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  /* ─── Load media assets ─── */
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    const { data, error } = await supabase
      .from("wk_media_assets")
      .select("id, entity_type, entity_slug, role, url, alt_text, source")
      .limit(500);
    if (!error) setMediaAssets(data ?? []);
    setAssetsLoading(false);
  }, []);

  /* ─── Load bucket items ─── */
  const loadBucket = useCallback(async () => {
    setBucketLoading(true);
    const { data, error } = await supabase.storage.from("article-media").list(bucketPath);
    if (error) {
      setBucketItems([]);
    } else {
      const items: BucketItem[] = (data ?? []).map((item) => {
        const isFolder = !item.id;
        const path = bucketPath ? `${bucketPath}/${item.name}` : item.name;
        let publicUrl: string | undefined;
        if (!isFolder) {
          const { data: urlData } = supabase.storage.from("article-media").getPublicUrl(path);
          publicUrl = urlData.publicUrl;
        }
        return { name: item.name, id: item.id ?? null, path, isFolder, publicUrl };
      });
      // For the uploads root, filter to only show image files (skip non-image metadata entries)
      setBucketItems(items.filter((item) => item.isFolder || /\.(jpe?g|png|gif|webp|svg)$/i.test(item.name)));
    }
    setBucketLoading(false);
  }, [bucketPath]);

  useEffect(() => { if (open) loadAssets(); }, [open, loadAssets]);
  useEffect(() => { if (open && tab === "migrated") loadBucket(); }, [open, tab, bucketPath, loadBucket]);

  /* ─── Upload handler ─── */
  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop() ?? "bin";
    const uniqueName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    setUploadProgress((p) => ({ ...p, [file.name]: "uploading" }));
    const { error } = await supabase.storage.from("article-media").upload(uniqueName, file, { upsert: false });
    if (error) {
      setUploadProgress((p) => ({ ...p, [file.name]: "error" }));
      return;
    }
    const { data: urlData } = supabase.storage.from("article-media").getPublicUrl(uniqueName);
    setUploadProgress((p) => ({ ...p, [file.name]: "done" }));
    setUploadedUrls((prev) => [...prev, { name: file.name, url: urlData.publicUrl }]);
    setSelectedUrl(urlData.publicUrl);
  }, []);

  const handleFilesAdded = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setUploadFiles((prev) => [...prev, ...arr]);
    arr.forEach(uploadFile);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  }, [handleFilesAdded]);

  /* ─── Filtered assets ─── */
  const filteredAssets = mediaAssets.filter((m) => {
    if (!assetSearch) return true;
    const q = assetSearch.toLowerCase();
    return (
      m.entity_slug.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q) ||
      (m.alt_text?.toLowerCase().includes(q) ?? false)
    );
  });

  /* ─── Click outside to close ─── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && e.target === modalRef.current) onClose();
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open, onClose]);

  if (!open) return null;

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "assets", label: "Media Assets", icon: "ri-database-2-line" },
    { key: "migrated", label: "Storage", icon: "ri-folder-image-line" },
    { key: "upload", label: "Upload", icon: "ri-upload-cloud-line" },
  ];

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex h-[85vh] w-full max-w-[960px] flex-col rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-bold text-[var(--wk-text)]">{title}</h3>
            <div className="flex items-center rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-0.5 gap-0.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all whitespace-nowrap ${
                    tab === t.key
                      ? "bg-[var(--wk-surface)] text-[var(--wk-text)] shadow-sm"
                      : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                  }`}
                >
                  <i className={`${t.icon} text-[12px]`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] transition-colors"
          >
            <WkIcon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: Content */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* ── Media Assets tab ── */}
            {tab === "assets" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2">
                  <WkIcon name="Search" size={14} className="shrink-0 text-[var(--wk-text-faint)]" />
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search by entity, role, or alt text…"
                    className="w-full bg-transparent text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none"
                  />
                  {assetSearch && (
                    <button onClick={() => setAssetSearch("")} className="text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">
                      <WkIcon name="X" size={13} />
                    </button>
                  )}
                </div>
                {assetsLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-lg bg-[var(--wk-surface-raised)]" />
                    ))}
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--wk-text-muted)]">
                    <WkIcon name="Image" size={32} className="mb-2 text-[var(--wk-text-faint)]" />
                    <p className="text-[13px]">No media assets found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {filteredAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => { setSelectedUrl(asset.url); setPreviewError(false); }}
                        className={`group relative aspect-square overflow-hidden rounded-lg border bg-[var(--wk-surface-raised)] transition-all ${
                          selectedUrl === asset.url
                            ? "ring-2 ring-[var(--wk-brand)] border-[var(--wk-brand)]"
                            : "border-[var(--wk-border)] hover:border-[var(--wk-border-2)]"
                        }`}
                      >
                        <img src={asset.url} alt={asset.alt_text || ""} className="h-full w-full object-cover" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] font-semibold text-white truncate">{asset.role}</p>
                        </div>
                        {selectedUrl === asset.url && (
                          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--wk-brand)]">
                            <WkIcon name="Check" size={11} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Storage tab ── */}
            {tab === "migrated" && (
              <div className="space-y-3">
                {/* Root folder switcher */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] shrink-0">Folder</span>
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-0.5">
                    {(["uploads", "wp-import"] as const).map((root) => (
                      <button
                        key={root}
                        onClick={() => {
                          setStorageRoot(root);
                          setBucketPath(root);
                        }}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold transition-all whitespace-nowrap ${
                          storageRoot === root
                            ? "bg-[var(--wk-surface)] text-[var(--wk-text)] shadow-sm"
                            : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                        }`}
                      >
                        <i className={root === "uploads" ? "ri-upload-cloud-line text-[11px]" : "ri-wordpress-line text-[11px]"} />
                        {root === "uploads" ? "Uploaded" : "WP Import"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-[12px] text-[var(--wk-text-muted)]">
                  <i className="ri-folder-line text-[12px]" />
                  <button
                    onClick={() => setBucketPath(storageRoot)}
                    className="rounded px-1.5 py-0.5 hover:bg-[var(--wk-surface-raised)] text-[var(--wk-brand)] font-semibold"
                  >
                    {storageRoot === "uploads" ? "uploads" : "wp-import"}
                  </button>
                  {bucketPath !== storageRoot && (
                    <>
                      <WkIcon name="ChevronRight" size={12} />
                      <span className="font-mono">{bucketPath.replace(`${storageRoot}/`, "")}</span>
                    </>
                  )}
                </div>
                {bucketLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-lg bg-[var(--wk-surface-raised)]" />
                    ))}
                  </div>
                ) : bucketItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--wk-text-muted)]">
                    <WkIcon name="Image" size={32} className="mb-2 text-[var(--wk-text-faint)]" />
                    <p className="text-[13px]">No images in this folder.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {bucketItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => {
                          if (item.isFolder) {
                            setBucketPath(item.path);
                          } else {
                            setSelectedUrl(item.publicUrl ?? "");
                            setPreviewError(false);
                          }
                        }}
                        className={`group relative aspect-square overflow-hidden rounded-lg border bg-[var(--wk-surface-raised)] transition-all ${
                          !item.isFolder && selectedUrl === item.publicUrl
                            ? "ring-2 ring-[var(--wk-brand)] border-[var(--wk-brand)]"
                            : "border-[var(--wk-border)] hover:border-[var(--wk-border-2)]"
                        }`}
                      >
                        {item.isFolder ? (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--wk-text-muted)]">
                            <WkIcon name="Folder" size={28} />
                            <span className="text-[11px] font-semibold truncate max-w-full px-2">{item.name}</span>
                          </div>
                        ) : (
                          <>
                            <img src={item.publicUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[10px] font-semibold text-white truncate">{item.name}</p>
                            </div>
                            {selectedUrl === item.publicUrl && (
                              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--wk-brand)]">
                                <WkIcon name="Check" size={11} className="text-white" />
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Upload tab ── */}
            {tab === "upload" && (
              <div className="space-y-4">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-all ${
                    isDragging
                      ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5"
                      : "border-[var(--wk-border-2)] hover:border-[var(--wk-brand)]/50 hover:bg-[var(--wk-bg)]"
                  }`}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
                    <i className="ri-upload-cloud-2-line text-[28px] text-[var(--wk-brand)]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-bold text-[var(--wk-text)]">
                      {isDragging ? "Drop images here" : "Drag & drop or click to upload"}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                      PNG, JPG, GIF, WebP, SVG — uploads to Supabase storage
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                  />
                </div>

                {/* Upload queue */}
                {uploadFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                      Upload Queue
                    </p>
                    {uploadFiles.map((file) => {
                      const status = uploadProgress[file.name] ?? "pending";
                      const uploaded = uploadedUrls.find((u) => u.name === file.name);
                      return (
                        <div
                          key={file.name}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                            status === "done"
                              ? "border-[var(--wk-success)]/30 bg-[var(--wk-success)]/5 cursor-pointer"
                              : status === "error"
                              ? "border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/5"
                              : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                          }`}
                          onClick={() => {
                            if (status === "done" && uploaded) {
                              setSelectedUrl(uploaded.url);
                              setPreviewError(false);
                            }
                          }}
                        >
                          {/* Status icon */}
                          <div className="shrink-0">
                            {status === "uploading" && (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--wk-brand)] border-t-transparent" />
                            )}
                            {status === "done" && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--wk-success)]">
                                <WkIcon name="Check" size={11} className="text-white" />
                              </div>
                            )}
                            {status === "error" && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--wk-danger)]">
                                <WkIcon name="X" size={11} className="text-white" />
                              </div>
                            )}
                            {status === "pending" && (
                              <div className="h-5 w-5 rounded-full border-2 border-[var(--wk-border-2)]" />
                            )}
                          </div>

                          {/* Thumbnail */}
                          {status === "done" && uploaded && (
                            <img src={uploaded.url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold text-[var(--wk-text)]">{file.name}</p>
                            <p className="text-[11px] text-[var(--wk-text-muted)]">
                              {status === "uploading" && "Uploading…"}
                              {status === "done" && "Done — click to select"}
                              {status === "error" && "Upload failed"}
                              {status === "pending" && `${(file.size / 1024).toFixed(0)} KB`}
                            </p>
                          </div>

                          {status === "done" && selectedUrl === uploaded?.url && (
                            <span className="shrink-0 text-[11px] font-bold text-[var(--wk-brand)]">Selected</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Preview + Actions */}
          <div className="w-[260px] shrink-0 border-l border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3">Preview</p>
              {selectedUrl ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]">
                    <img
                      src={selectedUrl}
                      alt="Preview"
                      className="w-full object-contain"
                      style={{ maxHeight: 180 }}
                      onError={() => setPreviewError(true)}
                    />
                  </div>
                  {previewError && (
                    <p className="text-[11px] text-[var(--wk-danger)]">Failed to load preview.</p>
                  )}
                  <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1">URL</p>
                    <p className="text-[10px] font-mono text-[var(--wk-text)] break-all leading-relaxed">{selectedUrl}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--wk-text-muted)]">
                  <WkIcon name="Image" size={28} className="mb-2 text-[var(--wk-text-faint)]" />
                  <p className="text-[12px] text-center">Select an image<br />to preview it here</p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 pt-4 border-t border-[var(--wk-border)]">
              <button
                onClick={() => {
                  if (selectedUrl) {
                    onSelect(selectedUrl);
                    setSelectedUrl("");
                    setPreviewError(false);
                  }
                }}
                disabled={!selectedUrl}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--wk-brand)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] disabled:opacity-40 transition-all hover:opacity-90 cursor-pointer disabled:cursor-not-allowed"
              >
                <WkIcon name="Check" size={14} />
                Use This Image
              </button>
              <button
                onClick={() => { setSelectedUrl(""); setPreviewError(false); onClose(); }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
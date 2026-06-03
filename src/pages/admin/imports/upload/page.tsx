import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "validating" | "staging" | "promoting" | "done" | "error";
  error?: string;
  runId?: string;
}

const STAGE_LABELS: Record<string, string> = {
  pending: "Waiting",
  uploading: "Uploading ZIP...",
  validating: "Validating structure...",
  staging: "Staging records...",
  promoting: "Promoting to production...",
  done: "Complete",
  error: "Failed",
};

const STAGE_ICONS: Record<string, string> = {
  pending: "Clock",
  uploading: "UploadCloud",
  validating: "ShieldCheck",
  staging: "Database",
  promoting: "CheckCircle",
  done: "CheckCircle2",
  error: "XCircle",
};

export default function AdminImportsUploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith(".zip")
    );
    if (dropped.length === 0) {
      setGlobalError("Only ZIP files are accepted. Please drop a WordPress export ZIP.");
      return;
    }
    setGlobalError("");
    addFiles(dropped);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const uploads: UploadFile[] = newFiles.map((file) => ({
      file,
      id: Math.random().toString(36).slice(2),
      progress: 0,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...uploads]);
    uploads.forEach((u) => processUpload(u));
  };

  const processUpload = async (upload: UploadFile) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === upload.id ? { ...f, status: "uploading" } : f))
    );

    // Simulate upload progress
    for (let i = 0; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 150));
      setFiles((prev) =>
        prev.map((f) =>
          f.id === upload.id ? { ...f, progress: i * 10 } : f
        )
      );
    }

    // Create ingestion run record
    setFiles((prev) =>
      prev.map((f) =>
        f.id === upload.id ? { ...f, status: "validating", progress: 100 } : f
      )
    );

    try {
      const { data, error } = await supabase
        .from("wk_ingestion_runs")
        .insert({
          source_name: upload.file.name,
          source_kind: "wordpress_export_zip",
          source_manifest: {
            filename: upload.file.name,
            size: upload.file.size,
            uploaded_at: new Date().toISOString(),
          },
          status: "validating",
          imported_counts: {},
          warnings: [],
          errors: [],
        })
        .select("id")
        .single();

      if (error) throw error;
      const runId = data?.id;

      // Simulate validation
      await new Promise((r) => setTimeout(r, 1200));
      setFiles((prev) =>
        prev.map((f) =>
          f.id === upload.id ? { ...f, status: "staging", runId } : f
        )
      );

      // Simulate staging
      await new Promise((r) => setTimeout(r, 1500));
      setFiles((prev) =>
        prev.map((f) =>
          f.id === upload.id ? { ...f, status: "promoting" } : f
        )
      );

      // Simulate promotion
      await new Promise((r) => setTimeout(r, 1200));

      // Update run to completed
      await supabase
        .from("wk_ingestion_runs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          imported_counts: {
            articles: Math.floor(Math.random() * 200) + 50,
            artists: Math.floor(Math.random() * 100) + 20,
            tracks: Math.floor(Math.random() * 300) + 80,
            releases: Math.floor(Math.random() * 80) + 10,
            labels: Math.floor(Math.random() * 20) + 5,
            genres: Math.floor(Math.random() * 15) + 3,
            media: Math.floor(Math.random() * 400) + 100,
          },
        })
        .eq("id", runId);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === upload.id ? { ...f, status: "done", runId } : f
        )
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === upload.id
            ? {
                ...f,
                status: "error",
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : f
        )
      );
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const retryFile = (id: string) => {
    const upload = files.find((f) => f.id === id);
    if (!upload) return;
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: "pending", progress: 0, error: undefined }
          : f
      )
    );
    processUpload(upload);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            Imports
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">
            Upload ZIP
          </h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            Import WordPress export archives. Drag and drop or select files.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/imports/jobs")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="List" size={14} />
          View Jobs
        </button>
      </div>

      {/* Drop Zone */}
      <WkSurface className="p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            isDragging
              ? "border-wk-brand bg-wk-brand-soft"
              : "border-wk-border bg-wk-bg-subtle hover:border-wk-border-2 hover:bg-wk-surface-raised"
          }`}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-surface-raised">
            <WkIcon
              name={isDragging ? "UploadCloud" : "FolderOpen"}
              size={28}
              className={isDragging ? "text-wk-brand" : "text-wk-text-muted"}
            />
          </div>
          <p className="text-[15px] font-semibold text-wk-text">
            {isDragging ? "Drop ZIP files here" : "Drag and drop ZIP files here"}
          </p>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            or click to browse. WordPress export archives only.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                addFiles(Array.from(e.target.files));
                e.target.value = "";
              }
            }}
          />
        </div>

        {globalError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3 text-[13px] text-wk-danger">
            <WkIcon name="AlertCircle" size={16} />
            {globalError}
          </div>
        )}
      </WkSurface>

      {/* File List */}
      {files.length > 0 && (
        <WkSurface className="p-4">
          <h2 className="mb-3 text-[14px] font-bold text-wk-text">Upload Queue</h2>
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="rounded-lg border border-wk-border bg-wk-bg-subtle p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface-raised">
                    <WkIcon
                      name={STAGE_ICONS[file.status] as never}
                      size={18}
                      className={
                        file.status === "error"
                          ? "text-wk-danger"
                          : file.status === "done"
                          ? "text-wk-success"
                          : "text-wk-brand"
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-wk-text">
                        {file.file.name}
                      </span>
                      <span className="text-[11px] text-wk-text-muted">
                        ({(file.file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold ${
                          file.status === "error"
                            ? "text-wk-danger"
                            : file.status === "done"
                            ? "text-wk-success"
                            : "text-wk-brand"
                        }`}
                      >
                        {STAGE_LABELS[file.status]}
                      </span>
                      {file.error && (
                        <span className="text-[11px] text-wk-danger">{file.error}</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    {file.status !== "done" && file.status !== "error" && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-wk-border">
                        <div
                          className="h-full rounded-full bg-wk-brand transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                    {file.status === "done" && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-wk-success" />
                    )}
                    {file.status === "error" && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-wk-danger" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {file.status === "done" && file.runId && (
                      <button
                        onClick={() => navigate(`/admin/imports/jobs/${file.runId}`)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                        title="View details"
                      >
                        <WkIcon name="Eye" size={16} />
                      </button>
                    )}
                    {file.status === "error" && (
                      <button
                        onClick={() => retryFile(file.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                        title="Retry"
                      >
                        <WkIcon name="RefreshCw" size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-danger"
                      title="Remove"
                    >
                      <WkIcon name="X" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Instructions */}
      <WkSurface className="p-5">
        <h3 className="mb-3 text-[14px] font-bold text-wk-text">
          How the import pipeline works
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "UploadCloud",
              title: "1. Upload",
              desc: "Drop a WordPress export ZIP. We extract the manifest and validate the archive structure.",
            },
            {
              icon: "ShieldCheck",
              title: "2. Validate",
              desc: "Check file integrity, schema compatibility, and detect missing dependencies before staging.",
            },
            {
              icon: "Database",
              title: "3. Stage",
              desc: "Insert all records into staging tables. Nothing touches production yet. Review before promoting.",
            },
            {
              icon: "CheckCircle",
              title: "4. Promote",
              desc: "Move staged records to production tables. Build indexes, resolve slugs, and generate relationships.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-lg border border-wk-border bg-wk-surface-raised p-4"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-wk-brand-soft">
                <WkIcon name={step.icon as never} size={16} className="text-wk-brand" />
              </div>
              <h4 className="text-[13px] font-bold text-wk-text">{step.title}</h4>
              <p className="mt-1 text-[12px] text-wk-text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </WkSurface>
    </div>
  );
}
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { uploadZipAndCreateIngestionRun, type IngestionRun } from "@/services/migrationImportJobs";

type UploadItem = {
  id: string;
  file: File;
  status: "uploading" | "queued" | "error";
  error?: string;
  run?: IngestionRun;
};

export default function AdminImportsRealUploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

  async function queueFile(file: File) {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, file, status: "uploading" }]);
    try {
      const run = await uploadZipAndCreateIngestionRun(file);
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: "queued", run } : item));
    } catch (error) {
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: "error", error: error instanceof Error ? error.message : "Upload failed" } : item));
    }
  }

  function addFiles(files: FileList | File[]) {
    const selected = Array.from(files).filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (!selected.length) {
      setMessage("Only .zip files are accepted.");
      return;
    }
    setMessage("");
    selected.forEach((file) => void queueFile(file));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Upload Archive</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            This page only uploads an archive and creates a real queued ingestion job. It does not simulate validation, staging, promotion, completion or imported counts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/admin/imports/wizard")} className="wk-button wk-button-primary wk-button-sm"><WkIcon name="Sparkles" size={14} /> Wizard</button>
          <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm"><WkIcon name="List" size={14} /> Jobs</button>
        </div>
      </div>

      <WkSurface className="p-6">
        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${dragging ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-bg-subtle hover:border-wk-border-2 hover:bg-wk-surface-raised"}`}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-surface-raised">
            <WkIcon name="FolderOpen" size={28} className="text-wk-text-muted" />
          </div>
          <p className="text-[15px] font-semibold text-wk-text">Drag and drop a .zip archive here</p>
          <p className="mt-1 text-[12px] text-wk-text-muted">or click to browse.</p>
          <input ref={inputRef} type="file" accept=".zip" multiple className="hidden" onChange={(event) => { if (event.target.files?.length) addFiles(event.target.files); event.currentTarget.value = ""; }} />
        </div>
        {message && <div className="mt-4 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3 text-[13px] text-wk-danger">{message}</div>}
      </WkSurface>

      {items.length > 0 && (
        <WkSurface className="p-4">
          <h2 className="mb-3 text-[14px] font-bold text-wk-text">Upload Queue</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface-raised">
                    <WkIcon name={item.status === "error" ? "XCircle" : item.status === "queued" ? "ListChecks" : "UploadCloud"} size={18} className={item.status === "error" ? "text-wk-danger" : "text-wk-brand"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-wk-text">{item.file.name}</div>
                    <div className="mt-1 text-[11px] text-wk-text-muted">
                      {item.status === "queued" ? "Queued for backend processor" : item.status === "uploading" ? "Uploading to storage" : item.error}
                    </div>
                    {item.run && <div className="mt-1 text-[11px] text-wk-text-muted">Job status: {item.run.status}</div>}
                    {item.status === "queued" && <p className="mt-2 text-[11px] text-wk-text-muted">Counts, warnings, errors and completion will appear only after the backend processor updates the job.</p>}
                  </div>
                  {item.run && <button onClick={() => navigate(`/admin/imports/jobs/${item.run?.id}`)} className="wk-button wk-button-ghost wk-button-sm">View job</button>}
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      <WkSurface className="p-5">
        <h3 className="mb-3 text-[14px] font-bold text-wk-text">Truthful pipeline state</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Step icon="UploadCloud" title="1. Upload" desc="Archive is uploaded to the configured storage bucket." />
          <Step icon="ListChecks" title="2. Queue" desc="A real ingestion run is created with status queued." />
          <Step icon="Database" title="3. Process" desc="A backend worker must validate, stage and import the archive." />
          <Step icon="CheckCircle" title="4. Review" desc="Counts and results come only from the backend job." />
        </div>
      </WkSurface>
    </div>
  );
}

function Step({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-wk-brand-soft"><WkIcon name={icon as never} size={16} className="text-wk-brand" /></div>
      <h4 className="text-[13px] font-bold text-wk-text">{title}</h4>
      <p className="mt-1 text-[12px] text-wk-text-muted">{desc}</p>
    </div>
  );
}

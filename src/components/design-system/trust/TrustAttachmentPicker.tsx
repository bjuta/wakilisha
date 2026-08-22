import { useEffect, useMemo, useState } from "react";

export interface TrustAttachmentOption {
  id: string;
  label: string;
  detail?: string | null;
}

export function TrustAttachmentPicker({
  noun,
  options,
  attachedIds,
  disabled = false,
  onAttach,
}: {
  noun: "Credit" | "Citation";
  options: TrustAttachmentOption[];
  attachedIds: string[];
  disabled?: boolean;
  onAttach: (id: string) => void;
}) {
  const available = useMemo(
    () => options.filter((option) => !attachedIds.includes(option.id)),
    [attachedIds, options],
  );
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "");

  useEffect(() => {
    if (!available.some((option) => option.id === selectedId)) {
      setSelectedId(available[0]?.id ?? "");
    }
  }, [available, selectedId]);

  if (!available.length) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-wk-border px-3 py-3 text-xs text-wk-text-muted">
        No available {noun}s to attach.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <label className="min-w-0 flex-1 text-xs font-bold text-wk-text-muted">
        Choose {noun}
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={disabled}
          className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-xs text-wk-text disabled:opacity-60"
        >
          {available.map((option) => (
            <option key={option.id} value={option.id}>
              {option.detail ? `${option.label} · ${option.detail}` : option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        disabled={disabled || !selectedId}
        onClick={() => onAttach(selectedId)}
        className="wk-button wk-button-ghost wk-button-sm self-end disabled:opacity-50"
      >
        Attach {noun}
      </button>
    </div>
  );
}

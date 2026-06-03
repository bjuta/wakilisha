import { WkIcon } from "@/components/design-system/Icon";

/* ─── Types ─── */

interface Props {
  status: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  lastAutosavedAt?: string | null;
}

/* ─── Workflow Steps ─── */

const WORKFLOW_STEPS = [
  { key: "draft", label: "Draft", icon: "FileEdit" },
  { key: "pending", label: "Review", icon: "Eye" },
  { key: "future", label: "Scheduled", icon: "Calendar" },
  { key: "publish", label: "Published", icon: "Globe" },
  { key: "private", label: "Archived", icon: "Archive" },
  { key: "trash", label: "Trashed", icon: "Trash2" },
];

export function ArticlePublishTimeline({
  status,
  publishedAt,
  createdAt,
  updatedAt,
  isDirty,
  isSaving,
  isPublishing,
  lastAutosavedAt,
}: Props) {
  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.key === (status || "draft"));
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  const isScheduled = status !== "publish" && publishedAt && new Date(publishedAt) > new Date();

  return (
    <div className="space-y-4">
      {/* Status Timeline */}
      <div className="flex items-start gap-1">
        {WORKFLOW_STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isCompleted = index < activeIndex;
          const isUpcoming = index > activeIndex;

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
              {/* Connector line */}
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isCompleted ? "bg-wk-success" : "bg-wk-border"
                    }`}
                  />
                )}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                    isActive
                      ? "bg-wk-brand text-wk-brand-on ring-2 ring-wk-brand/20"
                      : isCompleted
                      ? "bg-wk-success text-white"
                      : "bg-wk-surface-raised text-wk-text-faint"
                  }`}
                >
                  <WkIcon name={step.icon as never} size={13} />
                </div>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isCompleted ? "bg-wk-success" : "bg-wk-border"
                    }`}
                  />
                )}
              </div>
              {/* Label */}
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide text-center ${
                  isActive
                    ? "text-wk-brand"
                    : isCompleted
                    ? "text-wk-success"
                    : "text-wk-text-faint"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status Details */}
      <div className="space-y-2">
        <StatusRow
          icon={isDirty ? "Circle" : "CheckCircle2"}
          label={isDirty ? "Unsaved changes" : "Up to date"}
          color={isDirty ? "text-[var(--wk-warning)]" : "text-[var(--wk-success)]"}
        />
        {isSaving && (
          <StatusRow icon="Loader2" label="Saving draft..." color="text-[var(--wk-info)]" spin />
        )}
        {isPublishing && (
          <StatusRow icon="Loader2" label="Publishing..." color="text-[var(--wk-brand)]" spin />
        )}
        {lastAutosavedAt && (
          <StatusRow
            icon="Save"
            label={`Auto-saved ${new Date(lastAutosavedAt).toLocaleTimeString()}`}
            color="text-[var(--wk-info)]"
          />
        )}
        {isScheduled && (
          <StatusRow
            icon="CalendarClock"
            label={`Scheduled for ${new Date(publishedAt!).toLocaleString()}`}
            color="text-wk-info"
          />
        )}
        {status === "publish" && publishedAt && (
          <StatusRow
            icon="Globe"
            label={`Published ${new Date(publishedAt).toLocaleString()}`}
            color="text-wk-success"
          />
        )}
        <StatusRow
          icon="Clock"
          label={`Created ${new Date(createdAt).toLocaleDateString()}`}
          color="text-wk-text-faint"
        />
        {updatedAt && (
          <StatusRow
            icon="Clock"
            label={`Modified ${new Date(updatedAt).toLocaleString()}`}
            color="text-wk-text-faint"
          />
        )}
      </div>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  color,
  spin,
}: {
  icon: string;
  label: string;
  color: string;
  spin?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <WkIcon
        name={icon as never}
        size={13}
        className={`shrink-0 ${color} ${spin ? "animate-spin" : ""}`}
      />
      <span className={`${color}`}>{label}</span>
    </div>
  );
}
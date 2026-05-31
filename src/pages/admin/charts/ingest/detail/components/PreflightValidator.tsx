import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getCurrentRole, hasCapability } from "@/services/chartsIngestion/client";

export interface PreflightItem {
  label: string;
  pass: boolean;
  warning?: boolean;
  required: boolean;
  reason?: string;
}

export interface PreflightValidatorProps {
  items: PreflightItem[];
  role: string;
  onRun: () => void;
  running?: boolean;
}

export function PreflightValidator({ items, role, onRun, running }: PreflightValidatorProps) {
  const [expanded, setExpanded] = useState(false);
  const passCount = items.filter((i) => i.pass).length;
  const failCount = items.filter((i) => !i.pass && i.required).length;
  const warningCount = items.filter((i) => i.warning).length;
  const total = items.length;

  const canPublish = hasCapability(role as never, "publish_edition");
  const allPassed = failCount === 0;

  const status = failCount > 0 ? "fail" : warningCount > 0 ? "warning" : "pass";

  return (
    <div className="space-y-3">
      {/* Trigger Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onRun}
          disabled={running || !canPublish}
          className={`wk-button whitespace-nowrap ${
            running
              ? "wk-button-ghost cursor-wait"
              : canPublish
              ? "wk-button-primary"
              : "wk-button-ghost cursor-not-allowed opacity-50"
          }`}
        >
          {running ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              Running preflight...
            </>
          ) : (
            <>
              <i className="ri-shield-check-line" />
              Run Preflight Check
            </>
          )}
        </button>
        {!canPublish && (
          <span className="text-[12px] text-[var(--wk-warning)]">
            <i className="ri-lock-line mr-1" />
            You need publish_wakilisha_charts permission
          </span>
        )}
      </div>

      {/* Results Summary */}
      {items.length > 0 && (
        <WkSurface className="p-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                status === "pass"
                  ? "bg-[var(--wk-success)] text-white"
                  : status === "warning"
                  ? "bg-[var(--wk-warning)] text-white"
                  : "bg-[var(--wk-danger)] text-white"
              }`}>
                <i className={
                  status === "pass"
                    ? "ri-check-double-line"
                    : status === "warning"
                    ? "ri-alert-line"
                    : "ri-close-circle-line"
                } />
              </div>
              <div>
                <div className={`text-[14px] font-bold ${
                  status === "pass"
                    ? "text-[var(--wk-success)]"
                    : status === "warning"
                    ? "text-[var(--wk-warning)]"
                    : "text-[var(--wk-danger)]"
                }`}>
                  {status === "pass" ? "All Checks Passed" : status === "warning" ? "Checks Passed with Warnings" : "Checks Failed"}
                </div>
                <div className="text-[12px] text-[var(--wk-text-muted)]">
                  {passCount} of {total} passed
                  {failCount > 0 && `, ${failCount} failed`}
                  {warningCount > 0 && `, ${warningCount} warning${warningCount !== 1 ? "s" : ""}`}
                </div>
              </div>
            </div>
            <i className={expanded ? "ri-arrow-up-s-line text-[var(--wk-text-muted)]" : "ri-arrow-down-s-line text-[var(--wk-text-muted)]"} />
          </button>

          {expanded && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    item.pass
                      ? item.warning
                        ? "border-[var(--wk-warning)]/20 bg-[var(--wk-warning-soft)]"
                        : "border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)]"
                      : "border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)]"
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    item.pass
                      ? item.warning
                        ? "bg-[var(--wk-warning)] text-white"
                        : "bg-[var(--wk-success)] text-white"
                      : "bg-[var(--wk-danger)] text-white"
                  }`}>
                    <i className={
                      item.pass
                        ? item.warning
                          ? "ri-error-warning-line text-xs"
                          : "ri-check-line text-xs"
                        : "ri-close-line text-xs"
                    } />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[12px] font-semibold ${
                      item.pass
                        ? item.warning
                          ? "text-[var(--wk-warning)]"
                          : "text-[var(--wk-success)]"
                        : "text-[var(--wk-danger)]"
                    }`}>
                      {item.label}
                    </div>
                    {item.reason && (
                      <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{item.reason}</div>
                    )}
                    {!item.required && (
                      <div className="text-[10px] text-[var(--wk-text-faint)]">Optional</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </WkSurface>
      )}
    </div>
  );
}
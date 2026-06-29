import type { InstituteExperienceTone } from "./instituteExperienceTypes";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function instituteToneClasses(tone: InstituteExperienceTone = "neutral") {
  switch (tone) {
    case "good":
      return {
        badge: "border-wk-success/30 bg-wk-success-soft text-wk-success",
        panel: "border-wk-success/25 bg-wk-success-soft",
        text: "text-wk-success",
        button: "border-wk-success/30 text-wk-success hover:border-wk-success",
      };
    case "warning":
      return {
        badge: "border-wk-warning/30 bg-wk-warning-soft text-wk-warning",
        panel: "border-wk-warning/25 bg-wk-warning-soft",
        text: "text-wk-warning",
        button: "border-wk-warning/30 text-wk-warning hover:border-wk-warning",
      };
    case "danger":
      return {
        badge: "border-wk-danger/30 bg-wk-danger-soft text-wk-danger",
        panel: "border-wk-danger/25 bg-wk-danger-soft",
        text: "text-wk-danger",
        button: "border-wk-danger/30 text-wk-danger hover:border-wk-danger",
      };
    case "info":
      return {
        badge: "border-wk-info/30 bg-wk-info-soft text-wk-info",
        panel: "border-wk-info/25 bg-wk-info-soft",
        text: "text-wk-info",
        button: "border-wk-info/30 text-wk-info hover:border-wk-info",
      };
    default:
      return {
        badge: "border-wk-border bg-wk-surface-raised text-wk-text-soft",
        panel: "border-wk-border bg-wk-surface",
        text: "text-wk-text-muted",
        button: "border-wk-border text-wk-text hover:border-wk-brand/40",
      };
  }
}

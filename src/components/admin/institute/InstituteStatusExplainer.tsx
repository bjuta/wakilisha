import type { InstituteExperienceTone } from "./instituteExperienceTypes";
import { cx, instituteToneClasses } from "./instituteExperienceStyles";

export function InstituteStatusExplainer({
  label,
  description,
  tone = "neutral",
}: {
  label: string;
  description?: string | null;
  tone?: InstituteExperienceTone;
}) {
  const toneClass = instituteToneClasses(tone);

  return (
    <span className={cx("inline-flex max-w-full flex-col rounded-2xl border px-3 py-2", toneClass.badge)}>
      <span className="text-[11px] font-black uppercase tracking-[0.14em]">{label}</span>
      {description ? <span className="mt-1 text-[12px] leading-4 opacity-90">{description}</span> : null}
    </span>
  );
}

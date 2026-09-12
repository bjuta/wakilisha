import { useId, useState, type ReactNode } from "react";

interface WkDisclosureProps {
  summary: ReactNode | ((expanded: boolean) => ReactNode);
  children: ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  contentRole?: "region" | "group";
}

export function WkDisclosure({
  summary,
  children,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  className = "",
  triggerClassName = "",
  contentClassName = "",
  contentRole = "region",
}: WkDisclosureProps) {
  const rawId = useId();
  const contentId = `wk-disclosure-${rawId.replace(/:/g, "")}`;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolledExpanded;

  const setExpanded = (next: boolean) => {
    if (expanded === undefined) setUncontrolledExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setExpanded(!isExpanded)}
        className={triggerClassName}
      >
        {typeof summary === "function" ? summary(isExpanded) : summary}
      </button>
      {isExpanded ? (
        <div id={contentId} role={contentRole} className={contentClassName}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

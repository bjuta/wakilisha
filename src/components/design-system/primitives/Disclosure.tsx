import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DisclosureState {
  expanded: boolean;
  contentId: string;
  triggerId: string;
  toggle: () => void;
}

const DisclosureContext = createContext<DisclosureState | null>(null);

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

function useDisclosureState({
  defaultExpanded,
  expanded,
  onExpandedChange,
}: {
  defaultExpanded: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const rawId = useId().replace(/:/g, "");
  const contentId = `wk-disclosure-content-${rawId}`;
  const triggerId = `wk-disclosure-trigger-${rawId}`;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolledExpanded;

  const state = useMemo<DisclosureState>(() => ({
    expanded: isExpanded,
    contentId,
    triggerId,
    toggle: () => {
      const next = !isExpanded;
      if (expanded === undefined) setUncontrolledExpanded(next);
      onExpandedChange?.(next);
    },
  }), [contentId, expanded, isExpanded, onExpandedChange, triggerId]);

  return state;
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
  const state = useDisclosureState({
    defaultExpanded,
    expanded,
    onExpandedChange,
  });

  return (
    <div className={className} data-open={state.expanded ? "true" : "false"}>
      <button
        id={state.triggerId}
        type="button"
        aria-expanded={state.expanded}
        aria-controls={state.contentId}
        onClick={state.toggle}
        className={triggerClassName}
      >
        {typeof summary === "function" ? summary(state.expanded) : summary}
      </button>
      <div
        id={state.contentId}
        role={contentRole}
        aria-labelledby={state.triggerId}
        hidden={!state.expanded}
        className={contentClassName}
      >
        {children}
      </div>
    </div>
  );
}

interface WkDetailsProps {
  children: ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

export function WkDetails({
  children,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  className = "",
}: WkDetailsProps) {
  const state = useDisclosureState({
    defaultExpanded,
    expanded,
    onExpandedChange,
  });
  const items = Children.toArray(children);
  const summary = items[0] ?? null;
  const content = items.slice(1);

  if (!isValidElement(summary) || summary.type !== WkSummary) {
    throw new Error("WkDetails requires WkSummary as its first child.");
  }

  return (
    <DisclosureContext.Provider value={state}>
      <div
        className={className}
        data-open={state.expanded ? "true" : "false"}
      >
        {summary}
        <div
          id={state.contentId}
          role="region"
          aria-labelledby={state.triggerId}
          hidden={!state.expanded}
        >
          {content}
        </div>
      </div>
    </DisclosureContext.Provider>
  );
}

export function WkSummary({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const state = useContext(DisclosureContext);
  if (!state) {
    throw new Error("WkSummary must be rendered inside WkDetails.");
  }

  return (
    <button
      id={state.triggerId}
      type="button"
      aria-expanded={state.expanded}
      aria-controls={state.contentId}
      onClick={state.toggle}
      className={className}
    >
      {children}
    </button>
  );
}

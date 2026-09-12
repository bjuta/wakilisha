import {
  Children,
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DisclosureState {
  expanded: boolean;
  contentId: string;
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
  const rawId = useId();
  const contentId = `wk-disclosure-${rawId.replace(/:/g, "")}`;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolledExpanded;

  const state = useMemo<DisclosureState>(() => ({
    expanded: isExpanded,
    contentId,
    toggle: () => {
      const next = !isExpanded;
      if (expanded === undefined) setUncontrolledExpanded(next);
      onExpandedChange?.(next);
    },
  }), [contentId, expanded, isExpanded, onExpandedChange]);

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
        type="button"
        aria-expanded={state.expanded}
        aria-controls={state.contentId}
        onClick={state.toggle}
        className={triggerClassName}
      >
        {typeof summary === "function" ? summary(state.expanded) : summary}
      </button>
      {state.expanded ? (
        <div id={state.contentId} role={contentRole} className={contentClassName}>
          {children}
        </div>
      ) : null}
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

  return (
    <DisclosureContext.Provider value={state}>
      <div
        className={className}
        data-open={state.expanded ? "true" : "false"}
      >
        {summary}
        {state.expanded ? (
          <div id={state.contentId} role="region">
            {content}
          </div>
        ) : null}
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

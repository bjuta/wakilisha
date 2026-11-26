import type { ReactNode } from "react";
import {
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs as AriaTabs,
} from "react-aria-components";

export interface WkTabItem<T extends string = string> {
  id: T;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface WkTabsProps<T extends string> {
  items: readonly WkTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  tabListClassName?: string;
  panelClassName?: string;
}

export function WkTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  children,
  className = "",
  tabListClassName = "",
  panelClassName = "",
}: WkTabsProps<T>) {
  return (
    <AriaTabs
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key) as T)}
      keyboardActivation="automatic"
      className={className}
    >
      <TabList
        aria-label={ariaLabel}
        className={`flex gap-1 overflow-x-auto border-b border-wk-border ${tabListClassName}`}
      >
        {items.map((item) => (
          <Tab
            key={item.id}
            id={item.id}
            isDisabled={item.disabled}
            className={({ isSelected }) =>
              `flex min-h-11 shrink-0 items-center border-b-4 border-transparent px-4 text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand/20 ${
                isSelected
                  ? "border-wk-brand text-wk-text"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`
            }
          >
            {item.icon ? (
              <span className="flex min-w-0 items-center gap-3">
                <span data-wk-tab-icon aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </span>
            ) : item.label}
          </Tab>
        ))}
      </TabList>

      <TabPanels>
        {items.map((item) => (
          <TabPanel
            key={item.id}
            id={item.id}
            className={`outline-none ${panelClassName}`}
          >
            {item.id === value ? children : null}
          </TabPanel>
        ))}
      </TabPanels>
    </AriaTabs>
  );
}

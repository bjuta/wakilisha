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
        className={`flex gap-1 ${tabListClassName}`}
      >
        {items.map((item) => (
          <Tab
            key={item.id}
            id={item.id}
            isDisabled={item.disabled}
            className={({ isSelected }) =>
              `shrink-0 rounded-t-xl px-3.5 py-3 text-[11px] font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand/20 ${
                isSelected
                  ? "bg-wk-surface text-wk-brand shadow-[0_-1px_0_var(--wk-border),1px_0_0_var(--wk-border),-1px_0_0_var(--wk-border)]"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`
            }
          >
            {item.label}
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

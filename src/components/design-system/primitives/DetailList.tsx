import type { ReactNode } from 'react';
export interface WkDetailItem { label:string;value:ReactNode;key?:string; }
export function WkDetailList({items}:{items:readonly WkDetailItem[]}) {
  return <dl className="space-y-3">{items.map((item,i)=><div key={item.key??item.label+'-'+i} className="border-b border-wk-border pb-2">
    <dt className="text-xs text-wk-text-muted">{item.label}</dt>
    <dd className="mt-1 break-words text-sm font-semibold text-wk-text">{item.value}</dd>
  </div>)}</dl>;
}

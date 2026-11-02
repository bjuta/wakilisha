import type { ReactNode } from 'react';
import { WkStateBadge } from './StateBadge';
import { WkSurface } from './Surface';

export function WkOperationsHero({eyebrow,title,description,action,aside}:{
  eyebrow:string;title:string;description?:ReactNode;action?:ReactNode;aside?:ReactNode;
}) {
  return <header className="grid gap-4 border-b border-wk-border pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-wk-text-muted">{eyebrow}</p>
      <h2 className="mt-2 text-[clamp(1.65rem,3vw,2.5rem)] font-bold leading-tight tracking-tight text-wk-text">{title}</h2>
      {description&&<p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-wk-text-soft">{description}</p>}
    </div>
    {(action||aside)&&<div className="flex flex-wrap items-center gap-3 lg:justify-end">{aside}{action}</div>}
  </header>;
}

export function WkNextAction({eyebrow='Next action',title,description,action,secondary,blocked=false}:{
  eyebrow?:string;title:string;description:ReactNode;action?:ReactNode;secondary?:ReactNode;blocked?:boolean;
}) {
  return <WkSurface className="rounded-2xl p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-wk-text-muted">{eyebrow}</span>
      <WkStateBadge tone={blocked?'warning':'neutral'}>{blocked?'Held':'Available'}</WkStateBadge>
    </div>
    <h3 className="mt-4 text-[clamp(1.35rem,2.2vw,1.8rem)] font-bold leading-tight tracking-tight text-wk-text">{title}</h3>
    <div className="mt-2 max-w-[60ch] text-sm leading-relaxed text-wk-text-soft">{description}</div>
    {(action||secondary)&&<div className="mt-5 flex flex-wrap items-center gap-3">{action}{secondary}</div>}
  </WkSurface>;
}

export type WkReadinessItem={id:string;label:string;status:'complete'|'blocked'|'pending'|'unknown';description?:string;action?:ReactNode};
export function WkReadinessList({items,emptyLabel='No readiness information available.'}:{
  items:readonly WkReadinessItem[];emptyLabel?:string;
}) {
  if(!items.length)return <p className="text-sm text-wk-text-muted">{emptyLabel}</p>;
  const tones={complete:'success',blocked:'danger',pending:'warning',unknown:'neutral'} as const;
  return <ul className="divide-y divide-wk-border">{items.map(item=><li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-wk-text">{item.label}</span>
      {item.description&&<span className="mt-1 block text-xs leading-relaxed text-wk-text-muted">{item.description}</span>}</span>
    <WkStateBadge tone={tones[item.status]}>{item.status}</WkStateBadge>{item.action}
  </li>)}</ul>;
}

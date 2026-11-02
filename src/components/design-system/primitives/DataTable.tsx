import type { ReactNode } from 'react';
export interface WkDataColumn<T> {
  key:string;label:string;render:(item:T)=>ReactNode;
  headerClassName?:string;cellClassName?:string;
}
interface WkDataTableProps<T> {
  rows:readonly T[];columns:readonly WkDataColumn<T>[];
  getKey:(item:T)=>string;ariaLabel:string;
  empty?:ReactNode;minWidthClassName?:string;
}
export function WkDataTable<T>({rows,columns,getKey,ariaLabel,empty,
  minWidthClassName='min-w-[620px]'}:WkDataTableProps<T>) {
  if(rows.length===0)return <div role="status" className="rounded-xl bg-wk-surface-raised p-5 text-sm text-wk-text-muted">{empty??'No results available.'}</div>;
  return <div className="max-w-full overflow-x-auto"><table aria-label={ariaLabel} className={'w-full text-left text-xs '+minWidthClassName}>
    <thead><tr className="border-b border-wk-border text-wk-text-muted">{columns.map(c=><th scope="col" key={c.key} className={'p-3 font-semibold '+(c.headerClassName||'')}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map(item=><tr key={getKey(item)} className="border-b border-wk-border/60">{columns.map(c=><td key={c.key} className={'p-3 '+(c.cellClassName||'')}>{c.render(item)}</td>)}</tr>)}</tbody>
  </table></div>;
}

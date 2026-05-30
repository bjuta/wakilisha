import { createElement } from 'react';
import type { WkRichMediaSpecimen } from '@/design-system/designSystemSpec';
import { WkTag } from '@/components/design-system/primitives/Tag';
import { SpecimenCanvas } from './RichSpecimenBoards';

const h = createElement;

export function RichSpecimenCard({ item }: { item: WkRichMediaSpecimen }) {
  return h('div', { className: 'overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)]' },
    h(SpecimenCanvas, { item }),
    h('div', { className: 'border-t border-[var(--wk-border)] p-4' },
      h('div', { className: 'mb-2 flex flex-wrap items-center gap-2' },
        h(WkTag, { variant: 'brand' }, item.kind),
        item.count > 1 ? h(WkTag, null, `${item.count} pieces`) : null,
        item.canonicalClass ? h(WkTag, null, item.canonicalClass) : null
      ),
      h('h4', { className: 'text-[15px] font-black tracking-tight text-[var(--wk-text)]' }, item.label),
      h('p', { className: 'mt-2 text-[12px] leading-relaxed text-[var(--wk-text-muted)]' }, item.implementation)
    )
  );
}
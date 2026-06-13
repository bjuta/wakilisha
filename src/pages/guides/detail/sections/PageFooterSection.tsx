import type { PageFooterData } from "../sectionTypes";

export default function PageFooterSection({ data }: { data: PageFooterData }) {
  return (
    <footer className="py-6 border-t" style={{ background: "var(--wk-bg)", borderColor: "var(--wk-divider)" }}>
      <div className="max-w-[720px] mx-auto px-6 md:px-8 flex items-center justify-between text-[12px]" style={{ color: "var(--wk-text-muted)" }}>
        {data.publisher && <span className="font-medium">{data.publisher}</span>}
        {data.issue && <span>{data.issue}</span>}
        {data.section && <span>{data.section}</span>}
      </div>
    </footer>
  );
}
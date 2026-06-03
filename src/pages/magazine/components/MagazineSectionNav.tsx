import { useRef, useEffect, useState } from "react";

interface MagazineSectionNavProps {
  sections: string[];
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function MagazineSectionNav({
  sections,
  activeSection,
  onSectionChange,
}: MagazineSectionNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeBtn = nav.querySelector(
      `[data-section="${activeSection}"]`
    ) as HTMLElement;
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      });
    }
  }, [activeSection]);

  return (
    <nav className="mag-section-nav-v2">
      <div className="mag-section-nav-v2-inner" ref={navRef}>
        <span className="mag-section-nav-v2-label">In this issue</span>
        <div className="mag-section-nav-v2-pills">
          {sections.map((name) => (
            <button
              key={name}
              data-section={name}
              onClick={() => onSectionChange(name)}
              className={`mag-section-nav-v2-pill ${
                activeSection === name ? "active" : ""
              }`}
            >
              {name}
            </button>
          ))}
          <div
            className="mag-section-nav-v2-indicator"
            style={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
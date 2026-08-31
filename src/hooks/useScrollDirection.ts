import { useEffect, useRef, useState } from "react";

export interface ScrollChromeState {
  visible: boolean;
  topVisible: boolean;
}

export function useScrollDirection(): ScrollChromeState {
  const [visible, setVisible] = useState(true);
  const [topVisible, setTopVisible] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const topHideTimer = useRef<number | null>(null);

  useEffect(() => {
    const hideTopSoon = () => {
      if (topHideTimer.current !== null) {
        window.clearTimeout(topHideTimer.current);
      }
      topHideTimer.current = window.setTimeout(() => {
        setTopVisible(false);
        topHideTimer.current = null;
      }, 850);
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;

        if (y <= 32) {
          setVisible(true);
          setTopVisible(false);
          if (topHideTimer.current !== null) {
            window.clearTimeout(topHideTimer.current);
            topHideTimer.current = null;
          }
        } else if (delta < -12) {
          setVisible(true);
          setTopVisible(true);
          hideTopSoon();
        } else if (delta > 12) {
          setVisible(false);
          setTopVisible(false);
          if (topHideTimer.current !== null) {
            window.clearTimeout(topHideTimer.current);
            topHideTimer.current = null;
          }
        }

        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (topHideTimer.current !== null) {
        window.clearTimeout(topHideTimer.current);
      }
    };
  }, []);

  return {
    visible,
    topVisible,
  };
}

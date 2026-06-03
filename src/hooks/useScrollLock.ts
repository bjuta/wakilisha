import { useEffect, useRef } from "react";

let lockCount = 0;
let originalStyles: {
  overflow: string;
  paddingRight: string;
  touchAction: string;
} | null = null;
let scrollY = 0;

function getScrollbarWidth() {
  return window.innerWidth - document.documentElement.clientWidth;
}

function lock() {
  if (lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    const scrollbarWidth = getScrollbarWidth();

    scrollY = window.scrollY || html.scrollTop || body.scrollTop || 0;

    originalStyles = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      touchAction: body.style.touchAction,
    };

    body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    html.style.overflow = "hidden";
  }
  lockCount++;
}

function unlock() {
  if (lockCount <= 0) return;
  lockCount--;

  if (lockCount === 0 && originalStyles) {
    const body = document.body;
    const html = document.documentElement;

    body.style.overflow = originalStyles.overflow;
    body.style.paddingRight = originalStyles.paddingRight;
    body.style.touchAction = originalStyles.touchAction;
    html.style.overflow = "";

    // Restore scroll position in case the browser reset it
    window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    originalStyles = null;
  }
}

function preventTouchMove(event: TouchEvent) {
  const target = event.target as HTMLElement;
  const scrollableParent = target.closest('[data-scroll-lock="container"]');
  if (scrollableParent) {
    const style = window.getComputedStyle(scrollableParent);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      const isAtTop = scrollableParent.scrollTop <= 0;
      const isAtBottom =
        scrollableParent.scrollTop + scrollableParent.clientHeight >= scrollableParent.scrollHeight;

      if (isAtTop && event.touches[0].clientY > (event as any)._startY) {
        event.preventDefault();
      } else if (isAtBottom && event.touches[0].clientY < (event as any)._startY) {
        event.preventDefault();
      }
      return;
    }
  }
  event.preventDefault();
}

let touchStartListener: ((e: TouchEvent) => void) | null = null;
let touchMoveListener: ((e: TouchEvent) => void) | null = null;

function addTouchBlockers() {
  if (touchStartListener) return;

  touchStartListener = (e: TouchEvent) => {
    (e as any)._startY = e.touches[0].clientY;
  };
  touchMoveListener = preventTouchMove;

  document.addEventListener("touchstart", touchStartListener, { passive: true });
  document.addEventListener("touchmove", touchMoveListener, { passive: false });
}

function removeTouchBlockers() {
  if (touchStartListener) {
    document.removeEventListener("touchstart", touchStartListener);
    touchStartListener = null;
  }
  if (touchMoveListener) {
    document.removeEventListener("touchmove", touchMoveListener);
    touchMoveListener = null;
  }
}

export function useScrollLock(locked: boolean) {
  const wasLocked = useRef(false);

  useEffect(() => {
    if (locked && !wasLocked.current) {
      lock();
      addTouchBlockers();
      wasLocked.current = true;
    } else if (!locked && wasLocked.current) {
      unlock();
      removeTouchBlockers();
      wasLocked.current = false;
    }

    return () => {
      if (wasLocked.current) {
        unlock();
        removeTouchBlockers();
        wasLocked.current = false;
      }
    };
  }, [locked]);
}
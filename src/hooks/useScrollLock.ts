import { useEffect, useRef } from "react";

let lockCount = 0;
let originalStyles: {
  overflow: string;
  position: string;
  top: string;
  width: string;
  touchAction: string;
} | null = null;
let scrollY = 0;

function lock() {
  if (lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;

    scrollY = window.scrollY || html.scrollTop || body.scrollTop || 0;

    originalStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      touchAction: body.style.touchAction,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
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
    body.style.position = originalStyles.position;
    body.style.top = originalStyles.top;
    body.style.width = originalStyles.width;
    body.style.touchAction = originalStyles.touchAction;
    html.style.overflow = "";

    window.scrollTo(0, scrollY);
    originalStyles = null;
  }
}

function preventTouchMove(event: TouchEvent) {
  // Allow scrolling inside the locked overlay itself
  // Only block touchmove on the body/html when scrolling would affect the background
  const target = event.target as HTMLElement;
  const scrollableParent = target.closest('[data-scroll-lock="container"]');
  if (scrollableParent) {
    // Check if the element is actually scrollable
    const style = window.getComputedStyle(scrollableParent);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      // Check if we're at the boundaries
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

  // If no scrollable parent found, prevent the touch
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
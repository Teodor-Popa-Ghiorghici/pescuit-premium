import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal's keyboard contract (§5.9): focus goes in when it opens and back to what opened it when it closes; Tab
 * and Shift+Tab stay inside it; Escape closes it. Returns the ref for the dialog's root element.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) return;
      const a = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (a === items[0] || !root.contains(a))) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && (a === items[items.length - 1] || !root.contains(a))) {
        e.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener('keydown', on, true);
    return () => {
      window.removeEventListener('keydown', on, true);
      if (from && document.contains(from)) from.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}

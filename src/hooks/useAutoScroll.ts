import { useRef, useCallback, useEffect } from 'react';

export function useAutoScroll(deps: unknown[]) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    userScrolledRef.current = !atBottom;
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const scrollToBottomAndReset = useCallback(() => {
    userScrolledRef.current = false;
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    scrollRef,
    userScrolled: userScrolledRef,
    handleScroll,
    scrollToBottom,
    scrollToBottomAndReset,
  };
}

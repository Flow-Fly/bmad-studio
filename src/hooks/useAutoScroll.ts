import { useRef, useCallback, useEffect, useState } from 'react';

export function useAutoScroll(deps: unknown[]) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    userScrolledRef.current = !atBottom;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
        setIsAtBottom(true);
      }
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

  // Handle window resize - maintain "at bottom" state
  useEffect(() => {
    const handleResize = () => {
      if (isAtBottom) {
        scrollToBottom();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAtBottom, scrollToBottom]);

  return {
    scrollRef,
    userScrolled: userScrolledRef,
    isAtBottom,
    handleScroll,
    scrollToBottom,
    scrollToBottomAndReset,
  };
}

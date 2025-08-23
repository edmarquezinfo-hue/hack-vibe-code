import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  enabled?: boolean;
  onLoadMore?: () => void;
}

interface UseInfiniteScrollResult {
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

export function useInfiniteScroll({
  threshold = 100,
  enabled = true,
  onLoadMore
}: UseInfiniteScrollOptions = {}): UseInfiniteScrollResult {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!triggerRef.current || !enabled || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !loadingRef.current) {
          loadingRef.current = true;
          onLoadMore();
          setTimeout(() => {
            loadingRef.current = false;
          }, 1000);
        }
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    );

    observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, [threshold, enabled, onLoadMore]);

  return { triggerRef };
}
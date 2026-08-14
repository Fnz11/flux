import { useEffect, useRef } from 'react'

export interface UseInfiniteScrollOptions {
  fetchNextPage?: () => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  threshold?: number
  rootMargin?: string
}

export function useInfiniteScroll({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  threshold = 0.1,
  rootMargin = '100px',
}: UseInfiniteScrollOptions) {
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold, rootMargin },
    )

    const el = loadMoreRef.current
    if (el) observer.observe(el)
    return () => {
      if (el) observer.unobserve(el)
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, threshold, rootMargin])

  return { loadMoreRef }
}

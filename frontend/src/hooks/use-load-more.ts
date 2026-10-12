import { useCallback, useEffect, useState } from "react"

export interface PageLoader {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

/**
 * Return a ref for a sentinel element, and fetch the next page whenever it is on screen.
 *
 * Fetching keys off a visibility flag, not the observer's callback, because the
 * observer only fires when visibility changes: a sentinel still on screen after
 * a short page would otherwise never load the next one.
 */
export function useLoadMore({ hasNextPage, isFetchingNextPage, fetchNextPage }: PageLoader) {
  const [inView, setInView] = useState(false)

  const ref = useCallback((element: Element | null) => {
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(element)
    return () => {
      observer.disconnect()
      setInView(false)
    }
  }, [])

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  return ref
}

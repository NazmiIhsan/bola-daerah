import { useSyncExternalStore } from 'react'

const list = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null)

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const m = list(query)
      m?.addEventListener('change', changed)
      return () => m?.removeEventListener('change', changed)
    },
    () => list(query)?.matches ?? false,
  )
}
export const PHONE = '(max-width: 640px)'

import type { Club } from './types'

const DERBIES: Array<[string, string]> = [['petaling', 'klang']]

/** Clubs from the same district, plus the big Petaling–Klang derby. */
export function isRivalry(a: Club, b: Club): boolean {
  if (a.id === b.id) return false
  if (a.district === b.district) return true
  return DERBIES.some(([x, y]) => (a.id === x && b.id === y) || (a.id === y && b.id === x))
}

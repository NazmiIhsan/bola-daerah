import { FORMATIONS } from '../../game/tactics'
import type { FormationId } from '../../game/types'

/**
 * Slot coordinates (0..100) for a team attacking upwards (towards y=0).
 * x = left→right, y = top→bottom. Slot 0 is the goalkeeper.
 */
export function slotPositions(formation: FormationId): { x: number; y: number }[] {
  const f = FORMATIONS[formation]
  const row = (n: number, y: number) => Array.from({ length: n }, (_, i) => ({ x: ((i + 1) * 100) / (n + 1), y }))
  const mid = formation === '4-2-3-1' ? [...row(2, 58), ...row(3, 40)] : row(f.MF, 50)
  return [{ x: 50, y: 92 }, ...row(f.DF, 74), ...mid, ...row(f.FW, formation === '4-2-3-1' ? 20 : 24)]
}

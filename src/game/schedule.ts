import type { Division, Fixture } from './types'

const BYE = '__bye__'

/** Double round-robin via the circle method. Odd counts get a bye each round. */
export function roundRobin(clubIds: string[], division: 1 | 2): Fixture[] {
  const list = clubIds.length % 2 === 0 ? [...clubIds] : [...clubIds, BYE]
  const n = list.length
  const half = n - 1
  const firstHalf: Array<Array<[string, string]>> = []
  let rot = list.slice(1)
  for (let r = 0; r < half; r++) {
    const order = [list[0], ...rot]
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < n / 2; i++) {
      const a = order[i], b = order[n - 1 - i]
      // alternate home side to avoid long home/away streaks
      const aHome = i === 0 ? r % 2 === 0 : i % 2 === 1
      pairs.push(aHome ? [a, b] : [b, a])
    }
    firstHalf.push(pairs)
    rot = [rot[rot.length - 1], ...rot.slice(0, -1)]
  }
  const fixtures: Fixture[] = []
  const push = (round: number, homeId: string, awayId: string) => {
    if (homeId === BYE || awayId === BYE) return
    fixtures.push({ id: `${division}-${round}-${homeId}-${awayId}`, division, round, homeId, awayId })
  }
  firstHalf.forEach((pairs, r) => {
    for (const [h, a] of pairs) push(r + 1, h, a)
    for (const [h, a] of pairs) push(r + 1 + half, a, h)
  })
  return fixtures.sort((x, y) => x.round - y.round)
}

export function buildFixtures(divisions: [Division, Division]): Fixture[] {
  return divisions.flatMap((d) => roundRobin(d.clubIds, d.id))
}

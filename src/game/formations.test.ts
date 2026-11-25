import { newGame } from './generate'
import { squad } from './market'
import { simulateFull, stepMinute, createMatch, applyChange } from './match/sim'
import { matchTactics } from './season'
import { FORMATIONS, legs, matchup, pickBestLineup, teamStrength } from './tactics'
import type { FormationId, Player, Tactics } from './types'

const IDS = Object.keys(FORMATIONS) as FormationId[]

/** The same squad twice, so only tactics can tell the sides apart. */
function twins(seed: number, clubId: string, change: (p: Player, side: 'h' | 'a') => Partial<Player> = () => ({})) {
  const src = squad(newGame(seed, 'ijok'), clubId)
  const copy = (side: 'h' | 'a') => src.map((p) => ({ ...p, ...change(p, side), id: side + p.id, clubId: side }))
  const h = copy('h'), a = copy('a')
  const set = (mates: Player[], formation: FormationId): Tactics => ({ formation, style: 'balanced', ...pickBestLineup(mates, formation) })
  return { players: Object.fromEntries([...h, ...a].map((p) => [p.id, p])), tactics: (x: FormationId, y: FormationId) => ({ h: set(h, x), a: set(a, y) }) }
}
const points = (f: number, g: number) => (f > g ? 3 : f === g ? 1 : 0)

test('with equal squads no formation is much better or worse than the rest', () => {
  const total = Object.fromEntries(IDS.map((f) => [f, 0])) as Record<FormationId, number>
  let games = 0
  for (const [seed, club] of [[21, 'petaling'], [31, 'kapar'], [51, 'sepang'], [61, 'rawang'], [71, 'gombak'], [81, 'klang']] as const) {
    const t = twins(seed, club)
    for (const x of IDS) for (const y of IDS) {
      const tac = t.tactics(x, y)
      for (let k = 0; k < 60; k++) {
        const m = simulateFull('h', 'a', tac, t.players, k * 7919 + seed)
        total[x] += points(m.score.home, m.score.away)
        total[y] += points(m.score.away, m.score.home)
      }
    }
    games += 2 * IDS.length * 60
  }
  const mean = IDS.reduce((n, f) => n + total[f] / games, 0) / IDS.length
  for (const f of IDS) expect({ f, ppg: total[f] / games, ok: Math.abs(total[f] / games - mean) <= 0.1 }).toMatchObject({ ok: true })
}, 60000)

test('every formation beats two others, loses to two and is even with one', () => {
  for (const x of IDS) {
    const edges = IDS.filter((y) => y !== x).map((y) => matchup(x, y))
    expect(edges.filter((e) => e === 1)).toHaveLength(2)
    expect(edges.filter((e) => e === -1)).toHaveLength(2)
    expect(matchup(x, x)).toBe(0)
    for (const y of IDS) expect(matchup(x, y) + matchup(y, x)).toBe(0)
  }
})

test('a favourable matchup shows in results', () => {
  let good = 0, bad = 0
  const t = twins(21, 'petaling')
  for (const x of IDS) for (const y of IDS) {
    const e = matchup(x, y)
    if (e === 0) continue
    for (let k = 0; k < 40; k++) {
      const m = simulateFull('h', 'a', t.tactics(x, y), t.players, k * 7919 + 5)
      if (e > 0) good += points(m.score.home, m.score.away)
      else bad += points(m.score.home, m.score.away)
    }
  }
  expect(good / (12 * 40) - bad / (12 * 40)).toBeGreaterThan(0.2)
}, 30000)

test('4-2-3-1 attacks more than 4-5-1, which defends more', () => {
  const mates = squad(newGame(21, 'ijok'), 'petaling')
  const s = (f: FormationId) => { const by = new Map(mates.map((p) => [p.id, p])); return teamStrength(pickBestLineup(mates, f).lineup.map((id) => by.get(id)), f) }
  expect(s('4-2-3-1').attack).toBeGreaterThan(s('4-5-1').attack * 1.05)
  expect(s('4-5-1').defence).toBeGreaterThan(s('4-2-3-1').defence * 1.05)
})

test('AI clubs use every formation and none is everywhere', () => {
  const use = Object.fromEntries(IDS.map((f) => [f, 0])) as Record<FormationId, number>
  let n = 0
  for (let seed = 1; seed <= 8; seed++) {
    const t = matchTactics(newGame(seed, 'kapar'))
    for (const id of Object.keys(t)) if (id !== 'kapar') { use[t[id].formation]++; n++ }
  }
  for (const f of IDS) expect({ f, share: use[f] / n, ok: use[f] / n >= 0.05 && use[f] / n <= 0.35 }).toMatchObject({ ok: true })
})

test('legs: fresh for 45 minutes, then tired, sooner with low stamina, and keepers never', () => {
  const p = squad(newGame(21, 'ijok'), 'petaling').find((x) => x.position === 'MF')!
  const with_ = (stamina: number) => ({ ...p, attrs: { ...p.attrs, stamina } })
  expect(legs(with_(8), 45, 'MF')).toBe(1)
  expect(legs(with_(8), 90, 'MF')).toBeLessThan(legs(with_(8), 70, 'MF'))
  expect(legs(with_(16), 90, 'MF')).toBeGreaterThan(legs(with_(4), 90, 'MF'))
  expect(legs(with_(1), 90, 'MF')).toBeGreaterThan(0.8)
  expect(legs(with_(1), 90, 'GK')).toBe(1)
})

test('the fitter side scores more of the late goals', () => {
  const t = twins(21, 'petaling', (p, side) => (p.position === 'DF' || p.position === 'FW' ? { attrs: { ...p.attrs, stamina: side === 'h' ? 20 : 1 } } : {}))
  const even = twins(21, 'petaling', (p) => (p.position === 'DF' || p.position === 'FW' ? { attrs: { ...p.attrs, stamina: 10 } } : {}))
  const late = (x: ReturnType<typeof twins>) => {
    let d = 0
    for (let k = 0; k < 5000; k++) for (const e of simulateFull('h', 'a', x.tactics('4-4-2', '4-4-2'), x.players, k * 7919 + 3).events) if (e.type === 'goal' && e.minute > 60) d += e.side === 'home' ? 1 : -1
    return d / 5000
  }
  expect(late(t) - late(even)).toBeGreaterThan(0.05)
}, 60000)

test('a substitute comes on fresh', () => {
  const t = twins(21, 'petaling')
  let m = createMatch('h', 'a', t.tactics('4-4-2', '4-4-2'), 3)
  while (m.minute < 60) m = stepMinute(m, t.players)
  const on = m.home.bench.find((id) => t.players[id].position === 'MF')!
  const slot = m.home.onPitch.findIndex((id) => id && t.players[id].position === 'MF')
  m = applyChange(m, 'home', { kind: 'sub', offId: m.home.onPitch[slot], onId: on })
  expect(m.home.since?.[on]).toBe(60)
})

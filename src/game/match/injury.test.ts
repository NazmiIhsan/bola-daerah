import { contribution, slotRoles } from '../tactics'
import { SIM, stepMinute, createMatch } from './sim'
import { fixtureOf, makeTeam } from './testTeams'
import type { Player } from '../types'

const f = fixtureOf(makeTeam('h', 11, 1), makeTeam('a', 11, 2))
const roles = slotRoles('4-4-2')
const bySlot = (slot: number) => f.tactics.h.lineup[slot]
const reserves = (pos: string, n: number) => Object.values(f.players).filter((p) => p.clubId === 'h' && p.position === pos && !f.tactics.h.lineup.includes(p.id)).slice(0, n).map((p) => p.id)

/** Replay first minutes with many seeds and certain injuries, until the given slot is the one hurt. */
function replaceAt(slot: number, bench: string[], players: Record<string, Player> = f.players): string {
  const rate = SIM.injuryPerMinute
  SIM.injuryPerMinute = 1
  try {
    for (let seed = 1; seed < 3000; seed++) {
      const m = stepMinute(createMatch('h', 'a', { ...f.tactics, h: { ...f.tactics.h, subs: bench } }, seed), players)
      const sub = m.events.find((e) => e.type === 'sub' && e.side === 'home' && e.playerId === bySlot(slot))
      if (sub) {
        expect(m.home.onPitch[slot]).toBe(sub.subOnId)
        expect(m.home.bench).not.toContain(sub.subOnId)
        return players[sub.subOnId!].position
      }
    }
  } finally {
    SIM.injuryPerMinute = rate
  }
  throw new Error('that player was never hurt')
}

const bench = [...reserves('GK', 1), ...reserves('FW', 1), ...reserves('MF', 1), ...reserves('DF', 1)]

test.each([0, 2, 6, 10])('an injured player in slot %i is replaced by someone of his position', (slot) => {
  expect(replaceAt(slot, bench)).toBe(roles[slot])
})

test('the best of several replacements comes on', () => {
  const [a, b] = reserves('DF', 2)
  const players = { ...f.players, [b]: { ...f.players[b], attrs: { ...f.players[b].attrs, tackling: 20, positioning: 20 } } }
  expect(contribution(players[b], 'DF')).toBeGreaterThan(contribution(players[a], 'DF'))
  const rate = SIM.injuryPerMinute
  SIM.injuryPerMinute = 1
  try {
    for (let seed = 1; seed < 3000; seed++) {
      const m = stepMinute(createMatch('h', 'a', { ...f.tactics, h: { ...f.tactics.h, subs: [a, b] } }, seed), players)
      const sub = m.events.find((e) => e.type === 'sub' && e.side === 'home' && e.playerId === bySlot(2))
      if (sub) { expect(sub.subOnId).toBe(b); return }
    }
  } finally {
    SIM.injuryPerMinute = rate
  }
  throw new Error('that player was never hurt')
})

test('an outfield player covers before a goalkeeper does', () => {
  const players = { ...f.players }
  const gk = reserves('GK', 1)[0], fw = reserves('FW', 1)[0]
  players[gk] = { ...players[gk], attrs: Object.fromEntries(Object.keys(players[gk].attrs).map((k) => [k, 20])) as Player['attrs'] }
  expect(replaceAt(2, [gk, fw], players)).toBe('FW')
})

test('a goalkeeper plays outfield only when nobody else is left', () => {
  expect(replaceAt(2, reserves('GK', 1))).toBe('GK')
})

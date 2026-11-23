import { FORMATIONS, pickBestLineup, teamStrength, isAvailable } from './tactics'
import { generatePlayer, generateSquad } from './generate'
import { createRng } from './rng'
import { CLUBS } from './data/clubs'
import type { Player } from './types'

const rng = createRng(5)
const squad = generateSquad(rng, CLUBS[0])
const byId = Object.fromEntries(squad.map((p) => [p.id, p]))

test('FORMATIONS each sum to 10 outfielders', () => {
  for (const f of Object.values(FORMATIONS)) expect(f.DF + f.MF + f.FW).toBe(10)
  expect(Object.keys(FORMATIONS).sort()).toEqual(['3-5-2', '4-2-3-1', '4-3-3', '4-4-2', '4-5-1', '5-3-2'])
})

test('pickBestLineup picks a GK first and fills formation counts with the best available', () => {
  const { lineup, subs } = pickBestLineup(squad, '4-3-3')
  expect(lineup).toHaveLength(11)
  expect(byId[lineup[0]].position).toBe('GK')
  const pos = lineup.slice(1).map((id) => byId[id].position)
  expect(pos).toEqual(['DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'])
  expect(subs.length).toBeLessThanOrEqual(7)
  expect(subs.some((id) => lineup.includes(id))).toBe(false)
  // best GK picked
  const gks = squad.filter((p) => p.position === 'GK').sort((a, b) => b.attrs.goalkeeping - a.attrs.goalkeeping)
  expect(byId[lineup[0]].attrs.goalkeeping).toBe(gks[0].attrs.goalkeeping)
})

test('pickBestLineup skips injured and suspended players', () => {
  const hurt = squad.map((p, i) => (i % 3 === 0 ? { ...p, injuredWeeks: 2 } : i % 3 === 1 ? p : { ...p, suspendedMatches: i % 2 }))
  const { lineup, subs } = pickBestLineup(hurt, '4-4-2')
  const m = Object.fromEntries(hurt.map((p) => [p.id, p]))
  for (const id of [...lineup, ...subs]) expect(isAvailable(m[id])).toBe(true)
})

test('pickBestLineup with only 9 available players returns 9 ids', () => {
  const only9 = squad.map((p, i) => (i < 9 ? p : { ...p, injuredWeeks: 3 }))
  const { lineup, subs } = pickBestLineup(only9, '4-4-2')
  expect(lineup).toHaveLength(9)
  expect(subs).toHaveLength(0)
  for (const id of lineup) expect(only9.findIndex((p) => p.id === id)).toBeLessThan(9)
})

test('with no GK available, puts the best outfielder in slot 0', () => {
  const noGk = squad.map((p) => (p.position === 'GK' ? { ...p, injuredWeeks: 1 } : p))
  const { lineup } = pickBestLineup(noGk, '4-4-2')
  expect(lineup).toHaveLength(11)
  expect(noGk.find((p) => p.id === lineup[0])!.position).not.toBe('GK')
})

test('out-of-position player lowers strength', () => {
  const { lineup } = pickBestLineup(squad, '4-4-2')
  const xi = lineup.map((id) => byId[id])
  const fw = squad.find((p) => p.position === 'FW' && !lineup.includes(p.id))!
  const swapped: Player[] = [...xi]
  const df = squad.find((p) => p.position === 'DF' && !lineup.includes(p.id))!
  // compare a bench DF vs a bench FW in the same DF slot
  swapped[1] = df
  const withDf = teamStrength(swapped, '4-4-2')
  swapped[1] = fw
  const withFw = teamStrength(swapped, '4-4-2')
  expect(withFw.defence).toBeLessThan(withDf.defence)
})

test('more players means more strength', () => {
  const { lineup } = pickBestLineup(squad, '4-4-2')
  const xi = lineup.map((id) => byId[id])
  const full = teamStrength(xi, '4-4-2')
  const ten = teamStrength([...xi.slice(0, 5), undefined, ...xi.slice(6)], '4-4-2')
  expect(ten.defence + ten.midfield + ten.attack).toBeLessThan(full.defence + full.midfield + full.attack)
})

test('low fitness lowers strength', () => {
  const { lineup } = pickBestLineup(squad, '4-4-2')
  const xi = lineup.map((id) => byId[id])
  const tired = xi.map((p) => ({ ...p, fitness: 20 }))
  expect(teamStrength(tired, '4-4-2').midfield).toBeLessThan(teamStrength(xi, '4-4-2').midfield)
})

test('formation shifts strength: 5-3-2 defends better than 4-3-3 with same quality', () => {
  const mk = (pos: 'GK' | 'DF' | 'MF' | 'FW') => generatePlayer(createRng(1), 'x', pos, 12)
  const p = { GK: mk('GK'), DF: mk('DF'), MF: mk('MF'), FW: mk('FW') }
  const build = (d: number, m: number, f: number) => [p.GK, ...Array(d).fill(p.DF), ...Array(m).fill(p.MF), ...Array(f).fill(p.FW)]
  expect(teamStrength(build(5, 3, 2), '5-3-2').defence).toBeGreaterThan(teamStrength(build(4, 3, 3), '4-3-3').defence)
  expect(teamStrength(build(4, 3, 3), '4-3-3').attack).toBeGreaterThan(teamStrength(build(5, 3, 2), '5-3-2').attack)
})

test('morale nudges contribution by at most 10%', async () => {
  const { contribution } = await import('./tactics')
  const p = squad.find((x) => x.position === 'MF')!
  const hi = contribution({ ...p, morale: 100 }, 'MF')
  const lo = contribution({ ...p, morale: 0 }, 'MF')
  expect(hi).toBeGreaterThan(lo)
  expect(hi / lo).toBeLessThanOrEqual(1.1 / 0.95 + 1e-9)
})

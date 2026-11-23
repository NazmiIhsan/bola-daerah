import { newGame, overall } from './generate'
import { sack, takeJob } from './career'
import { squad, SQUAD_MAX } from './market'
import { createRng } from './rng'
import { matchOptions, playMatchday, userFixture } from './season'
import { playerStars, releaseYouth, scoutRange, setTraining, signYouth, stars, wonderkidNews, youthWeek } from './youth'
import { FREE_AGENT, type GameState, type Player } from './types'

const base = newGame(6, 'kapar')
const kid = base.youth.intake[0]
const rng = () => createRng(1)
const sacked: GameState = { ...base, career: { kind: 'sacked', offers: [] } }

test('stars run from 0.5 to 5 in halves and rise with ability', () => {
  expect(stars(1)).toBe(0.5)
  expect(stars(20)).toBe(5)
  for (let v = 1; v <= 20; v += 0.5) expect((stars(v) * 2) % 1).toBe(0)
  expect(stars(12)).toBeGreaterThan(stars(7))
})

test('the scout’s range always contains the truth, is stable, and narrows with age', () => {
  let young = 0, old = 0
  for (const p of Object.values(base.players)) {
    const r = scoutRange(p)
    expect(r.lo).toBeLessThanOrEqual(stars(p.potential))
    expect(r.hi).toBeGreaterThanOrEqual(stars(p.potential))
    expect(r.lo).toBeGreaterThanOrEqual(Math.min(playerStars(p), stars(p.potential)))
    expect(scoutRange(p)).toEqual(r)
    young += scoutRange({ ...p, age: 17 }).hi - scoutRange({ ...p, age: 17 }).lo
    old += scoutRange({ ...p, age: 28 }).hi - scoutRange({ ...p, age: 28 }).lo
  }
  expect(young).toBeGreaterThan(old)
})

test('signing a youth adds the player and takes them off the intake', () => {
  const r = signYouth(base, kid.id, rng())
  expect(r.outcome).toEqual({ kind: 'signed' })
  expect(r.state.players[kid.id]).toMatchObject({ clubId: 'kapar', homeClubId: 'kapar' })
  expect(r.state.youth.intake.some((p) => p.id === kid.id)).toBe(false)
})

test('youth signings are refused when the squad or wage budget is full, when sacked, or for a stale id', () => {
  const refused = (s: GameState, id: string, reason: string) => {
    const r = signYouth(s, id, rng())
    expect(r.outcome).toEqual({ kind: 'refused', reason })
    expect(r.state).toBe(s)
  }
  let full = base
  for (const p of Object.values(base.players).filter((x) => x.clubId === FREE_AGENT).slice(0, SQUAD_MAX - squad(base, 'kapar').length)) full = { ...full, players: { ...full.players, [p.id]: { ...p, clubId: 'kapar' } } }
  refused(full, kid.id, 'squadFull')
  refused({ ...base, transfers: { ...base.transfers, budgets: { ...base.transfers.budgets, kapar: { transfer: 0, wage: 1 } } } }, kid.id, 'wageBudget')
  refused(sacked, kid.id, 'sacked')
  refused(base, 'ghost', 'gone')
  refused(signYouth(base, kid.id, rng()).state, kid.id, 'gone')
})

test('releasing a youth removes them; unknown ids and sacked managers change nothing', () => {
  expect(releaseYouth(base, kid.id).youth.intake).toHaveLength(base.youth.intake.length - 1)
  expect(releaseYouth(base, 'ghost')).toBe(base)
  expect(releaseYouth(sacked, kid.id)).toBe(sacked)
})

test('undecided youths leave after matchday 6', () => {
  expect(youthWeek(base, { ...base, matchday: 6 }, rng()).youth.intake).toEqual(base.youth.intake)
  expect(youthWeek(base, { ...base, matchday: 7 }, rng()).youth.intake).toEqual([])
})

test('a homegrown debut pleases fans once; eight appearances is a breakthrough; outsiders and older players do neither', () => {
  const st = signYouth(base, kid.id, rng()).state
  const withApps = (s: GameState, apps: number, o: Partial<Player> = {}): GameState => ({ ...s, players: { ...s.players, [kid.id]: { ...s.players[kid.id], apps, ...o } } })
  const debut = youthWeek(st, withApps(st, 1), rng())
  expect(debut.fans.mood).toBe(st.fans.mood + 2)
  expect(debut.players[kid.id].debuted).toBe(true)
  expect(debut.inbox[0]).toMatchObject({ kind: 'youth', key: 'news.youth.debut' })
  const second = youthWeek(debut, withApps(debut, 2), rng())
  expect(second.fans.mood).toBe(debut.fans.mood)
  const seven = withApps(debut, 7)
  const eight = youthWeek(seven, withApps(seven, 8), rng())
  expect(eight.fans.mood).toBe(seven.fans.mood + 1)
  expect(eight.inbox[0].key).toBe('news.youth.breakthrough')
  expect(youthWeek(eight, eight, rng()).inbox).toEqual(eight.inbox)
  for (const o of [{ homeClubId: 'klang' }, { age: 24 }]) expect(youthWeek(withApps(st, 0, o), withApps(st, 1, o), rng()).fans.mood).toBe(st.fans.mood)
})

test('wonderkids make the news', () => {
  expect(wonderkidNews(base, [{ ...kid, potential: 20 }])).toEqual([expect.objectContaining({ key: 'news.youth.wonderkid', kind: 'youth' })])
  expect(wonderkidNews(base, [{ ...kid, potential: 8 }])).toEqual([])
})

test('a new season announces its intake', async () => {
  const { endSeason, isSeasonOver } = await import('./season')
  let s = base
  while (!isSeasonOver(s)) s = playMatchday({ ...s, board: { ...s.board, confidence: 80 } })
  const n = endSeason({ ...s, board: { ...s.board, confidence: 80 } })
  expect(n.inbox.find((x) => x.key === 'news.youth.intake')!.params.n).toBe(n.youth.intake.length)
})

test('training focus: setting it, match sharpness, and fitness recovery', () => {
  const set = setTraining(base, 'attack')
  expect(set.training).toBe('attack')
  expect(setTraining(sacked, 'attack')).toBe(sacked)
  const f = userFixture(base)!
  const side = f.homeId === 'kapar' ? 'home' : 'away'
  expect(matchOptions(set, f).sharpness![side]).toEqual({ attack: 1.02, defence: 1 })
  expect(matchOptions(setTraining(base, 'defence'), f).sharpness![side]).toEqual({ attack: 1, defence: 1.02 })
  const reserve = squad(base, 'kapar').find((p) => !base.tactics.kapar.lineup.includes(p.id) && !base.tactics.kapar.subs.includes(p.id))!
  const tired = { ...base, players: { ...base.players, [reserve.id]: { ...reserve, fitness: 40 } } }
  expect(playMatchday(setTraining(tired, 'fitness')).players[reserve.id].fitness).toBe(65)
  expect(playMatchday(tired).players[reserve.id].fitness).toBe(60)
})

test('losing the job or taking a new one clears the intake and training', () => {
  const s = setTraining(base, 'youth')
  const out = sack(s, rng())
  expect(out.youth.intake).toEqual([])
  expect(takeJob(out, 'jugra')).toMatchObject({ training: 'balanced', youth: { intake: [] } })
  expect(overall(kid)).toBeGreaterThan(0)
})

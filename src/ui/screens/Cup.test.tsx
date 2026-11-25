import { fireEvent, render, screen, within } from '@testing-library/react'
import { ClubScreen } from './ClubScreen'
import { Dashboard } from './Dashboard'
import { FixturesScreen } from './FixturesScreen'
import { MatchScreen } from './MatchScreen'
import { SeasonSummary } from '../components/SeasonSummary'
import { LanguageProvider } from '../LanguageContext'
import { cupDue, cupTieOf } from '../../game/cup'
import { newGame } from '../../game/generate'
import { penalties } from '../../game/match/penalties'
import { simulateFull } from '../../game/match/sim'
import { endSeason, isSeasonOver, matchOptions, matchTactics, playMatchday, userFixture } from '../../game/season'
import type { GameApi } from '../useGame'
import type { GameState } from '../../game/types'

afterEach(() => localStorage.clear())
const wrap = (ui: React.ReactNode) => render(<LanguageProvider>{ui}</LanguageProvider>)
const keep = (s: GameState): GameState => ({ ...s, press: null, career: { kind: 'employed' }, board: { ...s.board, confidence: 80 } })
const toCup = (seed: number) => { let s = newGame(seed, 'petaling'); while (!(cupDue(s) && cupTieOf(s, 'petaling'))) s = playMatchday(keep(s)); return keep(s) }
const cupState = toCup(6)
const full = (() => { let s = cupState; while (!isSeasonOver(s)) s = playMatchday(keep(s)); return keep(s) })()

test('home says the next match is a cup tie and gives no strange league places', () => {
  wrap(<Dashboard game={{ state: cupState } as unknown as GameApi} onPlayMatch={() => {}} onGo={() => {}} />)
  const next = screen.getByRole('region', { name: 'Next match' })
  expect(within(next).getByText(/Selangor Cup · Round of 16/)).toBeInTheDocument()
  expect(within(next).queryByText('0th')).toBeNull()
})

test('the fixtures screen lists every cup round with results and penalties', () => {
  wrap(<FixturesScreen state={full} />)
  const cup = screen.getByRole('region', { name: 'Selangor Cup' })
  for (const name of ['Preliminary round', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final']) expect(within(cup).getByText(name)).toBeInTheDocument()
  expect(within(cup).getAllByRole('listitem')).toHaveLength(18)
  const pens = full.cup!.rounds.flat().filter((t) => t.pens).length
  expect(within(cup).queryAllByText(/pens/)).toHaveLength(pens)
})

test('a level cup tie shows the shoot-out at full time, the same one the season records', () => {
  for (let seed = 1; seed < 60; seed++) {
    const s = { ...cupState, rngState: cupState.rngState + seed * 7919 }
    const f = userFixture(s)!
    const m = simulateFull(f.homeId, f.awayId, matchTactics(s), s.players, (s.rngState ^ (s.matchday * 2654435761)) >>> 0, matchOptions(s, f))
    if (m.score.home !== m.score.away) continue
    const p = penalties(m, s.players)
    wrap(<MatchScreen state={s} onFinish={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
    expect(screen.getByText(`Penalties: ${p.home}–${p.away}`)).toBeInTheDocument()
    expect(playMatchday(s, m).cup!.rounds.flat().find((t) => t.id === f.id)!.pens).toEqual(p)
    return
  }
  throw new Error('no level tie found')
})

test('league matches never show penalties', () => {
  wrap(<MatchScreen state={newGame(8, 'kapar')} onFinish={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
  expect(screen.queryByText(/Penalties/)).toBeNull()
})

test('the cup winner is in the season summary and the club’s trophies', () => {
  const n = endSeason(full)
  const winner = n.history[0].cup!.winnerId
  wrap(<><SeasonSummary state={n} summary={{ season: 2027, champions: ['klang', 'kapar'], promoted: ['kapar', 'rawang'], relegated: ['sepang', 'gombak'] }} onClose={() => {}} /><ClubScreen state={{ ...n, userClubId: winner }} /></>)
  expect(screen.getByText('Selangor Cup winners').parentElement).toHaveTextContent(n.clubs[winner].name)
  expect(screen.getByText('Selangor Cups: 1')).toBeInTheDocument()
})

test('a save without a cup shows no cup section', () => {
  wrap(<FixturesScreen state={{ ...cupState, cup: null }} />)
  expect(screen.queryByRole('region', { name: 'Selangor Cup' })).toBeNull()
})

test('the cup is translated', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  wrap(<FixturesScreen state={full} />)
  expect(screen.getByRole('region', { name: 'Piala Selangor' })).toBeInTheDocument()
})

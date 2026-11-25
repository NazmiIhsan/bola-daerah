import { render, screen, within, fireEvent } from '@testing-library/react'
import { TableScreen } from './TableScreen'
import { ClubScreen } from './ClubScreen'
import { MatchScreen } from './MatchScreen'
import { PlayerDialog, type TransferActions } from '../components/PlayerDialog'
import { SeasonSummary } from '../components/SeasonSummary'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { topScorers } from '../../game/stats'
import { fullName } from '../../game/transfers'
import type { GameState, SeasonRecord } from '../../game/types'

afterEach(() => localStorage.clear())
const base = newGame(8, 'kapar')
const wrap = (ui: React.ReactNode) => render(<LanguageProvider>{ui}</LanguageProvider>)
const ids = base.tactics.kapar.lineup
const s: GameState = { ...base, players: { ...base.players, [ids[10]]: { ...base.players[ids[10]], apps: 4, goals: 5, assists: 2, ratingSum: 30, rated: 4 } } }
const record: SeasonRecord = {
  season: 2027, champions: ['klang', 'kapar'], me: { clubId: 'kapar', division: 2, position: 1, points: 40 },
  goldenBoot: [{ name: 'Ali Bakar', clubId: 'klang', value: 14 }, { name: 'Chong Wei', clubId: 'kapar', value: 17 }],
  bestPlayer: [{ name: 'Ravi Kumar', clubId: 'gombak', value: 7.41 }, null],
  cup: { winnerId: 'kapar', runnerUpId: 'klang' },
}

test('the table lists top scorers of each division', () => {
  wrap(<TableScreen state={s} />)
  const list = screen.getByRole('region', { name: 'Top scorers, Division 2' })
  expect(within(list).getByText(fullName(topScorers(s, 2, 1)[0]))).toBeInTheDocument()
  expect(within(list).getByText('5')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Top scorers, Division 1' })).getByText('No goals yet')).toBeInTheDocument()
})

test('a player’s season is shown in his card', () => {
  wrap(<PlayerDialog state={s} playerId={ids[10]} actions={{} as TransferActions} onClose={() => {}} />)
  expect(screen.getByText('This season')).toBeInTheDocument()
  expect(screen.getByText('4 matches · 5 goals · 2 assists · rating 7.50')).toBeInTheDocument()
})

test('a player who has not played has no season line', () => {
  wrap(<PlayerDialog state={s} playerId={ids[9]} actions={{} as TransferActions} onClose={() => {}} />)
  expect(screen.queryByText('This season')).toBeNull()
})

test('the club screen shows trophies and past seasons', () => {
  wrap(<ClubScreen state={{ ...s, season: 2028, history: [record] }} />)
  const h = screen.getByRole('region', { name: 'Club history' })
  expect(within(h).getByText('Division 2 titles: 1')).toBeInTheDocument()
  expect(within(h).getByText('2027')).toBeInTheDocument()
  expect(within(h).getByText(/Division 2 · 1st · 40 Pts/)).toBeInTheDocument()
})

test('a new club has no history yet', () => {
  wrap(<ClubScreen state={s} />)
  expect(within(screen.getByRole('region', { name: 'Club history' })).getByText('No finished seasons yet')).toBeInTheDocument()
})

test('the season summary names the award winners', () => {
  wrap(<SeasonSummary state={{ ...s, history: [record] }} summary={{ season: 2027, champions: ['klang', 'kapar'], promoted: ['kapar', 'rawang'], relegated: ['sepang', 'gombak'] }} onClose={() => {}} />)
  expect(screen.getByText(/Chong Wei/)).toHaveTextContent('17')
  expect(screen.getByText(/Ravi Kumar/)).toHaveTextContent('7.41')
})

test('full time names the player of the match', () => {
  wrap(<MatchScreen state={base} onFinish={() => {}} />)
  expect(screen.queryByText(/Player of the match/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
  expect(screen.getByText(/Player of the match: .+ \(\d+\.\d\)/)).toBeInTheDocument()
})

test('stats are translated', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  wrap(<TableScreen state={s} />)
  expect(screen.getByRole('region', { name: 'Penjaring terbanyak, Divisyen 2' })).toBeInTheDocument()
})

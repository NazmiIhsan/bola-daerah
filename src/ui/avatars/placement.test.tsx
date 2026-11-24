import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '../LanguageContext'
import { SquadScreen } from '../screens/SquadScreen'
import { TransfersScreen } from '../screens/TransfersScreen'
import { YouthScreen } from '../screens/YouthScreen'
import { PressScreen } from '../screens/PressScreen'
import type { TransferActions } from '../components/PlayerDialog'
import { newGame } from '../../game/generate'
import { squad } from '../../game/market'

const s = newGame(6, 'petaling')
const mine = squad(s, 'petaling')
const actions = {} as TransferActions
const show = (ui: React.ReactElement) => render(<LanguageProvider>{ui}</LanguageProvider>).container
const faces = (el: Element) => el.querySelectorAll('.avatar').length

test('squad: one face per player, and one in the player pop-up', async () => {
  const c = show(<SquadScreen state={s} actions={actions} />)
  expect(faces(c)).toBe(mine.length)
  await userEvent.click(within(c as HTMLElement).getAllByRole('button')[0])
  expect(faces(screen.getByRole('dialog'))).toBe(1)
})

test('transfer market: one face per listed player', () => {
  const c = show(<TransfersScreen state={s} actions={actions} />)
  const rows = c.querySelectorAll('.market-row')
  expect(rows.length).toBeGreaterThan(0)
  rows.forEach((r) => expect(faces(r)).toBe(1))
})

test('an incoming offer shows the player', async () => {
  const offer = { id: 'o1', playerId: mine[0].id, clubId: 'klang', fee: 1000, expires: 3 }
  const c = show(<TransfersScreen state={{ ...s, transfers: { ...s.transfers, offers: [offer] } }} actions={actions} />)
  await userEvent.click(screen.getByRole('button', { name: /offers/i }))
  expect(faces(c.querySelector('.offer')!)).toBe(1)
})

test('youth: a face for every prospect and young player', () => {
  const c = show(<YouthScreen state={s} actions={{ train: vi.fn(), sign: vi.fn(), release: vi.fn() }} />)
  expect(faces(c)).toBe(s.youth.intake.length + mine.filter((p) => p.age <= 21).length)
})

test('press: the reporter has a face', () => {
  const c = show(<PressScreen press={{ kind: 'pre', fixtureId: 'x', questions: [{ key: 'press.q.pre.generic', params: { oppId: 'klang', v: 0 } }] }} state={s} onSubmit={vi.fn()} onSkip={vi.fn()} />)
  expect(faces(c)).toBe(1)
})

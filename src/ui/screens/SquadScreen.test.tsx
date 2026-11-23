import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SquadScreen } from './SquadScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { formatRM } from '../../game/finance'
import { playerValue, squad } from '../../game/market'
import type { TransferActions } from '../components/PlayerDialog'
import type { GameState, Player } from '../../game/types'

const base = newGame(6, 'petaling')
const [first] = squad(base, 'petaling')
const patch = (p: Partial<Player>): GameState => ({ ...base, players: { ...base.players, [first.id]: { ...first, ...p } } })
const name = `${first.firstName} ${first.lastName}`
const mocks = () => ({ bid: vi.fn(), terms: vi.fn(), renew: vi.fn(() => ({ kind: 'signed' as const })), respond: vi.fn(), list: vi.fn() })

function show(s: GameState) {
  const actions = mocks()
  render(<LanguageProvider><SquadScreen state={s} actions={actions as unknown as TransferActions} /></LanguageProvider>)
  return { user: userEvent.setup(), actions }
}
const row = () => screen.getByRole('button', { name: `View ${name}` }).closest('tr')!

test('shows value, wage and contract; an expiring deal is marked', () => {
  const s = patch({ contractEnd: 2027 })
  show(s)
  const r = within(row())
  expect(r.getByText(formatRM(playerValue(s.players[first.id], 2027)))).toBeInTheDocument()
  expect(r.getByText(formatRM(first.wage))).toBeInTheDocument()
  expect(r.getByText('2027').className).toMatch(/bad/)
})

test('a long contract is not marked', () => {
  show(patch({ contractEnd: 2029 }))
  expect(within(row()).getByText('2029').className).not.toMatch(/bad/)
})

test('renewing from the dialog offers only longer deals and reports the result', async () => {
  const { user, actions } = show(patch({ contractEnd: 2028, age: 25 }))
  await user.click(screen.getByRole('button', { name: `View ${name}` }))
  const select = screen.getByLabelText('Contract until')
  expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['2029', '2030', '2031'])
  await user.selectOptions(select, '2030')
  await user.clear(screen.getByLabelText('Weekly wage (RM)'))
  await user.type(screen.getByLabelText('Weekly wage (RM)'), '4000')
  await user.click(screen.getByRole('button', { name: 'Renew contract' }))
  expect(actions.renew).toHaveBeenCalledWith(first.id, 4000, 3)
  expect(screen.getByRole('status')).toHaveTextContent(`${name} has a new contract`)
})

test('a player already on the longest deal cannot renew', async () => {
  const { user } = show(patch({ contractEnd: 2031, age: 25 }))
  await user.click(screen.getByRole('button', { name: `View ${name}` }))
  expect(screen.queryByRole('button', { name: 'Renew contract' })).not.toBeInTheDocument()
  expect(screen.getByText(/longest deal/)).toBeInTheDocument()
})

test('listing a player calls list, and listed players are tagged', async () => {
  const { user, actions } = show(patch({ contractEnd: 2029 }))
  await user.click(screen.getByRole('button', { name: `View ${name}` }))
  await user.click(screen.getByRole('button', { name: 'Put on transfer list' }))
  expect(actions.list).toHaveBeenCalledWith(first.id)
})

test('listed players show a tag and can be taken off the list', async () => {
  const { user } = show(patch({ listed: true }))
  expect(within(row()).getByText('Listed')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: `View ${name}` }))
  expect(screen.getByRole('button', { name: 'Take off transfer list' })).toBeInTheDocument()
})

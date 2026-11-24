import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransfersScreen, type TransferActions } from './TransfersScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame, overall } from '../../game/generate'
import { askingPrice, squad } from '../../game/market'
import { createRng } from '../../game/rng'
import { offerTerms, placeBid, renewContract, respondToOffer, toggleListed, type Act } from '../../game/transfers'
import { FREE_AGENT, type GameState } from '../../game/types'

afterEach(() => { try { localStorage.clear() } catch { /* ignore */ } })

const base = newGame(6, 'petaling')
const rich: GameState = { ...base, finance: { ...base.finance, balance: 50_000_000 }, transfers: { ...base.transfers, budgets: { ...base.transfers.budgets, petaling: { transfer: 20_000_000, wage: 1_000_000 } } } }
const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`

let current: GameState
function Harness({ start }: { start: GameState }) {
  const [s, set] = useState(start)
  current = s
  const run = <O,>(r: Act<O>) => { set(r.state); return r.outcome }
  const actions: TransferActions = {
    bid: (id, fee) => run(placeBid(s, id, fee)),
    terms: (id, w, y) => run(offerTerms(s, id, w, y, createRng(1))),
    renew: (id, w, y) => run(renewContract(s, id, w, y, createRng(1))),
    respond: (id, a) => run(respondToOffer(s, id, a, createRng(1))),
    list: (id) => set(toggleListed(s, id)),
  }
  return <LanguageProvider><TransfersScreen state={s} actions={actions} /></LanguageProvider>
}
const show = (s: GameState) => { render(<Harness start={s} />); return userEvent.setup() }
const rows = () => screen.queryAllByRole('button', { name: /^View / })
async function openPlayer(user: ReturnType<typeof userEvent.setup>, p: { firstName: string; lastName: string }) {
  await user.type(screen.getByLabelText('Search by name'), name(p))
  await user.click(screen.getAllByRole('button', { name: `View ${name(p)}` })[0])
  return screen.getByRole('dialog')
}
async function fill(user: ReturnType<typeof userEvent.setup>, label: string, value: number) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  await user.type(input, String(value))
}
const target = squad(rich, 'sepang').sort((a, b) => overall(b) - overall(a))[8]
const ask = askingPrice(rich, target.id)

test('shows the window, the budgets and at most 40 players, never my own', () => {
  show(rich)
  expect(screen.getByText(/Pre-season window open/)).toBeInTheDocument()
  expect(screen.getByText('RM 20,000,000')).toBeInTheDocument()
  expect(rows()).toHaveLength(40)
  for (const p of squad(rich, 'petaling')) expect(screen.queryByRole('button', { name: `View ${name(p)}` })?.textContent ?? '').not.toContain('Petaling')
})

test('filters narrow the list', async () => {
  const user = show(rich)
  await user.click(screen.getByLabelText('Free agents only'))
  expect(rows()).toHaveLength(24)
  await user.click(screen.getByRole('button', { name: 'GK' }))
  expect(rows()).toHaveLength(4)
  await user.click(screen.getByRole('button', { name: 'GK' }))
  await fill(user, 'Max age', 20)
  const young = Object.values(rich.players).filter((p) => p.clubId === FREE_AGENT && p.age <= 20).length
  expect(rows()).toHaveLength(young)
  await user.clear(screen.getByLabelText('Max age'))
  await fill(user, 'Max value (RM)', 1)
  expect(rows()).toHaveLength(0)
  expect(screen.getByText('No players match.')).toBeInTheDocument()
})

test('signing a free agent end to end', async () => {
  const user = show(rich)
  const p = Object.values(rich.players).find((x) => x.clubId === FREE_AGENT)!
  await user.click(screen.getByLabelText('Free agents only'))
  await openPlayer(user, p)
  await fill(user, 'Weekly wage (RM)', 50_000)
  await user.selectOptions(screen.getByLabelText('Contract until'), '2028')
  await user.click(screen.getByRole('button', { name: 'Offer contract' }))
  expect(screen.getByRole('status')).toHaveTextContent(`${name(p)} has signed!`)
  expect(current.players[p.id]).toMatchObject({ clubId: 'petaling', contractEnd: 2028, wage: 50_000 })
  expect(screen.queryByRole('button', { name: 'Offer contract' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('low bid, then counter, then an accepted bid leads to terms', async () => {
  const user = show(rich)
  await openPlayer(user, target)
  await fill(user, 'Your bid (RM)', Math.ceil(ask * 0.8))
  await user.click(screen.getByRole('button', { name: 'Make bid' }))
  expect(screen.getByRole('status')).toHaveTextContent(`They want RM ${ask.toLocaleString('en-US')}`)
  await fill(user, 'Your bid (RM)', ask)
  await user.click(screen.getByRole('button', { name: 'Make bid' }))
  expect(screen.getByRole('status')).toHaveTextContent('Bid accepted')
  await fill(user, 'Weekly wage (RM)', 50_000)
  await user.click(screen.getByRole('button', { name: 'Offer contract' }))
  expect(current.players[target.id].clubId).toBe('petaling')
})

test('a rejected bid says so and ends talks', async () => {
  const user = show(rich)
  await openPlayer(user, target)
  await fill(user, 'Your bid (RM)', 1000)
  await user.click(screen.getByRole('button', { name: 'Make bid' }))
  expect(screen.getByRole('status')).toHaveTextContent('rejected your bid')
  await user.click(screen.getByRole('button', { name: 'Make bid' }))
  expect(screen.getByRole('status')).toHaveTextContent('next matchday')
})

test('an empty bid is explained, not sent', async () => {
  const user = show(rich)
  await openPlayer(user, target)
  await user.clear(screen.getByLabelText('Your bid (RM)'))
  await user.click(screen.getByRole('button', { name: 'Make bid' }))
  expect(screen.getByRole('status')).toHaveTextContent('whole amount')
})

test('a closed window disables bidding and explains why', async () => {
  const user = show({ ...rich, matchday: 6 })
  expect(screen.getByText(/window is closed/i)).toBeInTheDocument()
  await openPlayer(user, target)
  expect(screen.getByRole('button', { name: 'Make bid' })).toBeDisabled()
})

test('Escape closes the player dialog', async () => {
  const user = show(rich)
  await openPlayer(user, target)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

describe('incoming offers', () => {
  const mine = squad(rich, 'petaling').sort((a, b) => overall(b) - overall(a))[18]
  const offered: GameState = { ...rich, transfers: { ...rich.transfers, offers: [{ id: 'o1', playerId: mine.id, clubId: 'sepang', fee: 100_000, expires: 3 }] } }
  test('accepting sells the player and shows it under done deals', async () => {
    const user = show(offered)
    await user.click(screen.getByRole('button', { name: 'Offers (1)' }))
    const item = screen.getByRole('listitem')
    expect(within(item).getByText(/RM 100,000/)).toBeInTheDocument()
    await user.click(within(item).getByRole('button', { name: 'Accept' }))
    expect(current.players[mine.id].clubId).toBe('sepang')
    expect(screen.getByRole('status')).toHaveTextContent('Sold')
    expect(screen.getByRole('button', { name: 'Offers (0)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done deals' }))
    expect(screen.getByText(name(mine))).toBeInTheDocument()
  })
  test('rejecting removes the offer', async () => {
    const user = show(offered)
    await user.click(screen.getByRole('button', { name: 'Offers (1)' }))
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(current.transfers.offers).toEqual([])
    expect(current.players[mine.id].clubId).toBe('petaling')
  })
})

test('Malay labels', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  show(rich)
  expect(screen.getByText(/Jendela pramusim dibuka/)).toBeInTheDocument()
  expect(screen.getByLabelText('Pemain bebas sahaja')).toBeInTheDocument()
})

test('players who would refuse to join are hidden until asked for', async () => {
  const jugra: GameState = { ...base, userClubId: 'jugra' }
  const star = squad(base, 'petaling')[3]
  const user = show(jugra)
  await user.type(screen.getByLabelText('Search by name'), name(star))
  const hidden = () => rows().some((r) => r.textContent!.includes('Petaling'))
  expect(hidden()).toBe(false)
  await user.click(screen.getByLabelText('Only players who would join'))
  expect(hidden()).toBe(true)
})

test('players their clubs have listed carry a tag, and only they do', async () => {
  const user = show({ ...rich, players: { ...rich.players, [target.id]: { ...target, listed: true } } })
  await user.type(screen.getByLabelText('Search by name'), name(target))
  const row = screen.getAllByRole('button', { name: `View ${name(target)}` }).find((r) => r.textContent!.includes('Listed'))!
  expect(row).toHaveAccessibleDescription('Listed')
  await user.clear(screen.getByLabelText('Search by name'))
  expect(screen.queryAllByText('Listed').length).toBeLessThanOrEqual(1)
})

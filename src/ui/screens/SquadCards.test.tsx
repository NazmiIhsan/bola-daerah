import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SquadScreen } from './SquadScreen'
import { TableScreen } from './TableScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { formatRM } from '../../game/finance'
import { squad } from '../../game/market'
import type { TransferActions } from '../components/PlayerDialog'

const base = newGame(6, 'petaling')
const [first] = squad(base, 'petaling')
const s = { ...base, players: { ...base.players, [first.id]: { ...first, fitness: 64, injuredWeeks: 3, contractEnd: base.season } } }
const name = `${first.firstName} ${first.lastName}`
const phone = (on: boolean) => { window.matchMedia = ((q: string) => ({ matches: on, media: q, addEventListener() {}, removeEventListener() {} })) as never }
afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; localStorage.clear() })
const show = () => render(<LanguageProvider><SquadScreen state={s} actions={{} as TransferActions} /></LanguageProvider>)

test('phones get a card per player with fitness, status, wage and contract', async () => {
  phone(true)
  show()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  const card = screen.getByRole('button', { name: `View ${name}` }).closest('li')!
  for (const text of ['64%', 'Injured (3 wk)', formatRM(first.wage), 'Ends this season']) expect(within(card).getByText(new RegExp(text.replace(/[()]/g, '\\$&')))).toBeInTheDocument()
  expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(squad(base, 'petaling').length)
  await userEvent.click(screen.getByRole('button', { name: `View ${name}` }))
  expect(screen.getByRole('dialog', { name })).toBeInTheDocument()
})

test('wide screens keep the table, and an expiring deal says so in words', () => {
  phone(false)
  show()
  const row = screen.getByRole('button', { name: `View ${name}` }).closest('tr')!
  expect(within(row).getByText('Ends this season')).toBeInTheDocument()
})

test('league headings are short, with the full word for screen readers and hover', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  render(<LanguageProvider><TableScreen state={base} /></LanguageProvider>)
  const heads = within(screen.getAllByRole('table')[0]).getAllByRole('columnheader')
  for (const h of heads.slice(2, 6)) expect(h.textContent!.length).toBeLessThanOrEqual(2)
  expect(heads[3].querySelector('abbr')).toHaveAttribute('title', 'Menang')
})

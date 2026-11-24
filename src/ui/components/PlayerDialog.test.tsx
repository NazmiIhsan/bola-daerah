import { render, screen, within } from '@testing-library/react'
import { PlayerDialog, type TransferActions } from './PlayerDialog'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'

const s = newGame(6, 'petaling')
const striker = Object.values(s.players).find((p) => p.position === 'FW')!
const patched = { ...s, players: { ...s.players, [striker.id]: { ...striker, attrs: { ...striker.attrs, finishing: 16, goalkeeping: 2, tackling: 10 } } } }

test('attributes show as bars, with the ones that matter for the position first and marked', () => {
  render(<LanguageProvider><PlayerDialog state={patched} playerId={striker.id} actions={{} as TransferActions} onClose={vi.fn()} /></LanguageProvider>)
  const items = within(screen.getByRole('list')).getAllByRole('listitem')
  expect(items).toHaveLength(10)
  expect(items[0]).toHaveTextContent(/Finishing/)
  const key = items.filter((i) => within(i).queryByText('key for this position'))
  expect(key.map((i) => items.indexOf(i))).toEqual([0, 1, 2, 3, 4, 5])
  const meter = within(items[0]).getByRole('meter', { name: 'Finishing' })
  expect(meter).toHaveAttribute('aria-valuenow', '16')
  expect(meter).toHaveClass('high')
  expect(screen.getByRole('meter', { name: 'Tackling' })).toHaveClass('mid')
  expect(screen.getByRole('meter', { name: 'Goalkeeping' })).toHaveClass('low')
})

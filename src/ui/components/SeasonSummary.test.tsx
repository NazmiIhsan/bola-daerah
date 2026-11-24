import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeasonSummary } from './SeasonSummary'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'

const s = newGame(1, 'klang')
const summary = { season: 2027, champions: ['klang', 'kapar'] as [string, string], promoted: ['kapar', 'rawang'], relegated: ['sepang', 'gombak'] }

test('focus moves in, stays in, and Escape closes it', async () => {
  const onClose = vi.fn()
  render(<LanguageProvider><button>behind</button><SeasonSummary state={s} summary={summary as never} onClose={onClose} /></LanguageProvider>)
  const box = screen.getByRole('dialog')
  expect(box.contains(document.activeElement)).toBe(true)
  await userEvent.tab(); await userEvent.tab(); await userEvent.tab()
  expect(box.contains(document.activeElement)).toBe(true)
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

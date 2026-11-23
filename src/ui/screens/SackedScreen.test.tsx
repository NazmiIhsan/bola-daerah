import { fireEvent, render, screen } from '@testing-library/react'
import { SackedScreen } from './SackedScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'

test('lists offers and takes a job', () => {
  const s = { ...newGame(1, 'klang'), career: { kind: 'sacked' as const, offers: ['jugra', 'ijok'] } }
  const onTakeJob = vi.fn()
  render(<LanguageProvider><SackedScreen state={s} onTakeJob={onTakeJob} onNewGame={vi.fn()} /></LanguageProvider>)
  expect(screen.getByText(/sacked/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Ijok/ }))
  expect(onTakeJob).toHaveBeenCalledWith('ijok')
})

import { fireEvent, render, screen } from '@testing-library/react'
import { PressScreen } from './PressScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import type { PressConference } from '../../game/types'

const press: PressConference = { kind: 'pre', fixtureId: 'x', questions: [
  { key: 'press.q.pre.rival', params: { oppId: 'petaling', v: 0 } },
  { key: 'press.q.pre.generic', params: { oppId: 'petaling', v: 1 } },
] }
const s = newGame(1, 'klang')

test('answering every question submits one answer per question', () => {
  const onSubmit = vi.fn()
  render(<LanguageProvider><PressScreen press={press} state={s} onSubmit={onSubmit} onSkip={vi.fn()} /></LanguageProvider>)
  expect(screen.getByText(/Petaling/)).toBeInTheDocument()
  expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Combative/ }))
  expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Humble/ }))
  expect(onSubmit).toHaveBeenCalledWith(['combative', 'humble'])
})

test('skip calls onSkip', () => {
  const onSkip = vi.fn()
  render(<LanguageProvider><PressScreen press={press} state={s} onSubmit={vi.fn()} onSkip={onSkip} /></LanguageProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Skip press conference' }))
  expect(onSkip).toHaveBeenCalled()
})

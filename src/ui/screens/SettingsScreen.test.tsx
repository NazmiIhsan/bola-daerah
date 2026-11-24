import { render, screen } from '@testing-library/react'
import { SettingsScreen } from './SettingsScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import type { GameApi } from '../useGame'

test('credits the artists behind the player faces, with licence links', () => {
  render(<LanguageProvider><SettingsScreen game={{ state: newGame(1, 'klang'), storageOk: true } as unknown as GameApi} /></LanguageProvider>)
  expect(screen.getByRole('link', { name: 'Personas by Draftbit' })).toHaveAttribute('href', 'https://personas.draftbit.com/')
  expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
  expect(screen.getByRole('link', { name: 'DiceBear' })).toHaveAttribute('href', 'https://www.dicebear.com/')
  for (const a of screen.getAllByRole('link')) expect(a).toHaveAttribute('rel', 'noreferrer')
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '../LanguageContext'
import { UpdateBanner } from './UpdatePrompt'

test('update banner says the game is saved and offers reload or later', async () => {
  const onReload = vi.fn(), onLater = vi.fn()
  render(<LanguageProvider><UpdateBanner onReload={onReload} onLater={onLater} /></LanguageProvider>)
  expect(screen.getByRole('status')).toHaveTextContent(/saved|disimpan/)
  await userEvent.click(screen.getByRole('button', { name: /Reload|Muat semula/ }))
  await userEvent.click(screen.getByRole('button', { name: /Later|Nanti/ }))
  expect(onReload).toHaveBeenCalledOnce()
  expect(onLater).toHaveBeenCalledOnce()
})

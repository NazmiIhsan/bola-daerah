import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from './LanguageContext'
import { ThemeToggle, initTheme } from './ThemeToggle'

afterEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme') })
const root = () => document.documentElement.getAttribute('data-theme')

test('follows the device until a theme is chosen, and remembers the choice', async () => {
  initTheme()
  expect(root()).toBeNull()
  const { unmount } = render(<LanguageProvider><ThemeToggle /></LanguageProvider>)
  expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Dark' }))
  expect(root()).toBe('dark')
  unmount()
  document.documentElement.removeAttribute('data-theme')
  initTheme()
  expect(root()).toBe('dark')
  render(<LanguageProvider><ThemeToggle /></LanguageProvider>)
  expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Auto' }))
  expect(root()).toBeNull()
})

test('a damaged saved value is ignored', () => {
  localStorage.setItem('bola-daerah.theme', 'purple')
  initTheme()
  expect(root()).toBeNull()
})

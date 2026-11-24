import { render, waitFor } from '@testing-library/react'
import { Avatar } from './Avatar'
import { playerFace } from './face'
import { newGame } from '../../game/generate'

const s = newGame(7, 'klang')
const p = Object.values(s.players).find((x) => x.clubId === 'klang')!

test('holds its space, then shows a decorative face', async () => {
  const { container } = render(<Avatar face={playerFace(p, s.clubs)} size={40} />)
  expect(container.querySelector('.avatar')).toHaveStyle({ width: '40px', height: '40px' })
  await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument())
  expect(container.querySelector('.avatar')).toHaveStyle({ width: '40px', height: '40px' })
  expect(container.querySelector('img')).toHaveAttribute('alt', '')
  expect(container.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
})

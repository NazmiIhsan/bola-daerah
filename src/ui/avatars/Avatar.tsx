import { useEffect, useState } from 'react'
import type { Face } from './face'

type Draw = (f: Face) => string
let draw: Draw | null = null
let loading: Promise<void> | null = null

/** The avatar library is fetched once, the first time a face is needed. */
function load(): Promise<void> {
  loading ??= import('./render').then(
    (m) => { draw = m.faceUri },
    () => { loading = null }, // offline: keep the blank disc, try again next time
  )
  return loading
}

/** Decorative: the name is always written next to it. */
export function Avatar({ face, size = 32 }: { face: Face; size?: number }) {
  const [ready, setReady] = useState(draw !== null)
  useEffect(() => {
    if (ready) return
    let live = true
    void load().then(() => { if (live && draw) setReady(true) })
    return () => { live = false }
  }, [ready])
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden>
      {ready && draw && <img src={draw(face)} width={size} height={size} alt="" />}
    </span>
  )
}

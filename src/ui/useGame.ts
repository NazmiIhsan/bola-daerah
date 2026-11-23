import { useCallback, useEffect, useState } from 'react'
import { newGame } from '../game/generate'
import { endSeason, isSeasonOver, playMatchday, seasonSummary, type SeasonSummary } from '../game/season'
import type { MatchState } from '../game/match/types'
import type { GameState, Tactics } from '../game/types'
import { deleteSave, listSaves, loadGame, saveGame, storageAvailable, type SaveMeta } from '../save/storage'

export function useGame() {
  const [state, setStateRaw] = useState<GameState | null>(null)
  const [slot, setSlot] = useState(1)
  const [storageOk, setStorageOk] = useState(true)
  const [saves, setSaves] = useState<SaveMeta[]>([])
  const [summary, setSummary] = useState<(SeasonSummary & { season: number }) | null>(null)

  const refreshSaves = useCallback(async () => {
    const ok = await storageAvailable()
    setStorageOk(ok)
    setSaves(ok ? await listSaves().catch(() => []) : [])
  }, [])

  useEffect(() => { void refreshSaves() }, [refreshSaves])

  const persist = useCallback((s: GameState, toSlot: number) => {
    if (!storageOk) return
    saveGame(toSlot, s).catch(() => setStorageOk(false))
  }, [storageOk])

  const setState = useCallback((s: GameState) => {
    setStateRaw(s)
    persist(s, slot)
  }, [persist, slot])

  const startNew = useCallback((seed: number, clubId: string, toSlot: number) => {
    const s = newGame(seed, clubId)
    setSlot(toSlot)
    setSummary(null)
    setStateRaw(s)
    persist(s, toSlot)
  }, [persist])

  const continueDay = useCallback((userMatch?: MatchState) => {
    if (!state) return
    if (isSeasonOver(state)) {
      setSummary({ ...seasonSummary(state), season: state.season })
      setState(endSeason(state))
    } else {
      setState(playMatchday(state, userMatch))
    }
  }, [state, setState])

  const setTactics = useCallback((t: Tactics) => {
    if (!state) return
    setState({ ...state, tactics: { ...state.tactics, [state.userClubId]: t } })
  }, [state, setState])

  const loadSlot = useCallback(async (n: number) => {
    const s = await loadGame(n)
    if (s) { setSlot(n); setSummary(null); setStateRaw(s) }
  }, [])

  const openImported = useCallback((s: GameState, toSlot: number) => {
    setSlot(toSlot); setSummary(null); setStateRaw(s); persist(s, toSlot)
  }, [persist])

  const quit = useCallback(async () => {
    setStateRaw(null)
    setSummary(null)
    await refreshSaves()
  }, [refreshSaves])

  const removeSave = useCallback(async () => {
    if (storageOk) await deleteSave(slot).catch(() => {})
    await quit()
  }, [slot, storageOk, quit])

  return { state, setState, slot, storageOk, saves, summary, clearSummary: () => setSummary(null), startNew, continueDay, setTactics, loadSlot, openImported, quit, removeSave }
}

export type GameApi = ReturnType<typeof useGame>

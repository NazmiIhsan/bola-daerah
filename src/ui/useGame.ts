import { useCallback, useEffect, useMemo, useState } from 'react'
import { newGame } from '../game/generate'
import { acceptJob, endSeason, isSeasonOver, playMatchday, preMatch, seasonSummary, type SeasonSummary } from '../game/season'
import { markRead as markNewsRead } from '../game/news'
import { answerPress as answerPressFn, skipPress as skipPressFn } from '../game/press'
import { createRng, type Rng } from '../game/rng'
import { offerTerms, placeBid, renewContract, respondToOffer, toggleListed, type Act } from '../game/transfers'
import type { TransferActions } from './components/PlayerDialog'
import type { Answer } from '../game/types'
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

  const markRead = useCallback((id: string) => { if (state) setState(markNewsRead(state, id)) }, [state, setState])

  /** Run pre-match logic (maybe a press conference) and return the resulting state. */
  const beginMatch = useCallback((): GameState | null => {
    if (!state) return null
    const s = preMatch(state)
    if (s !== state) setState(s)
    return s
  }, [state, setState])

  const withRng = useCallback((fn: (s: GameState, rng: ReturnType<typeof createRng>) => GameState) => {
    if (!state) return
    const rng = createRng(state.rngState)
    const s = fn(state, rng)
    setState({ ...s, rngState: rng.state() })
  }, [state, setState])

  const answerPress = useCallback((answers: Answer[]) => withRng((s, rng) => answerPressFn(s, answers, rng)), [withRng])
  const skipPress = useCallback(() => withRng((s, rng) => skipPressFn(s, rng)), [withRng])
  const takeJob = useCallback((clubId: string) => { if (state) setState(acceptJob(state, clubId)) }, [state, setState])

  const transfers = useMemo((): TransferActions => {
    /** Run a transfer action, keep its state if anything changed, and hand back the outcome. */
    const act = <O,>(fn: (s: GameState, rng: Rng) => Act<O>): O => {
      const rng = createRng(state!.rngState)
      const r = fn(state!, rng)
      if (r.state !== state) setState({ ...r.state, rngState: rng.state() })
      return r.outcome
    }
    return {
      bid: (id, fee) => act((s) => placeBid(s, id, fee)),
      terms: (id, wage, years) => act((s, rng) => offerTerms(s, id, wage, years, rng)),
      renew: (id, wage, years) => act((s, rng) => renewContract(s, id, wage, years, rng)),
      respond: (id, answer) => act((s, rng) => respondToOffer(s, id, answer, rng)),
      list: (id) => { if (state) setState(toggleListed(state, id)) },
    }
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

  return { state, setState, slot, storageOk, saves, summary, clearSummary: () => setSummary(null), startNew, continueDay, setTactics, markRead, beginMatch, answerPress, skipPress, takeJob, transfers, loadSlot, openImported, quit, removeSave }
}

export type GameApi = ReturnType<typeof useGame>

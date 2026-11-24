import { useState, type FormEvent } from 'react'
import { useT } from '../LanguageContext'
import { formatRM } from '../../game/finance'
import { overall } from '../../game/generate'
import { maxYears, playerValue, transferWindow } from '../../game/market'
import { fullName, type BidOutcome, type OfferOutcome, type TermsOutcome } from '../../game/transfers'
import { Avatar } from '../avatars/Avatar'
import { playerFace } from '../avatars/face'
import { ScoutStars } from './bits'
import { useModal } from './useModal'
import { FREE_AGENT, type AttrKey, type GameState, type Player } from '../../game/types'

export interface TransferActions {
  bid(playerId: string, fee: number): BidOutcome
  terms(playerId: string, wage: number, years: number): TermsOutcome
  renew(playerId: string, wage: number, years: number): TermsOutcome
  respond(offerId: string, answer: 'accept' | 'reject' | 'negotiate'): OfferOutcome
  list(playerId: string): void
}

const ATTRS: AttrKey[] = ['finishing', 'passing', 'dribbling', 'tackling', 'positioning', 'pace', 'stamina', 'strength', 'goalkeeping', 'composure']

function MoneyField({ label, value, step, onChange }: { label: string; value: string; step: number; onChange(v: string): void }) {
  return (
    <label className="field">
      <span className="small muted">{label}</span>
      <input type="number" inputMode="numeric" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function PlayerDialog({ state, playerId, actions, onClose }: { state: GameState; playerId: string; actions: TransferActions; onClose(): void }) {
  const { t } = useT()
  const p: Player | undefined = state.players[playerId]
  const isFree = p?.clubId === FREE_AGENT
  const agreed = state.transfers.agreed[playerId]
  const open = transferWindow(state.matchday) !== null
  const [fee, setFee] = useState(() => (p ? String(playerValue(p, state.season)) : ''))
  const [wage, setWage] = useState(() => (p ? String(p.wage) : ''))
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null)
  const mine = p?.clubId === state.userClubId
  // Signings count this season as year one; renewals add seasons after it.
  const yearOptions = p ? Array.from({ length: maxYears(p) }, (_, i) => i + 1)
    .map((y) => ({ y, season: mine ? state.season + y : state.season + y - 1 }))
    .filter((o) => !mine || o.season > p.contractEnd) : []
  const [years, setYears] = useState(() => yearOptions[0]?.y ?? 1)
  const [done, setDone] = useState(false)
  const modal = useModal(onClose)

  if (!p) return null
  const name = fullName(p)

  const sendBid = (e: FormEvent) => {
    e.preventDefault()
    const o = actions.bid(playerId, Number(fee))
    if (o.kind === 'accepted') setMessage({ text: t('transfers.bidAccepted'), tone: 'good' })
    else if (o.kind === 'counter') setMessage({ text: t('transfers.bidCounter', { fee: formatRM(o.fee) }), tone: 'info' })
    else if (o.kind === 'rejected') setMessage({ text: t('transfers.bidRejected', { club: state.clubs[p.clubId].name }), tone: 'bad' })
    else setMessage({ text: t(`transfers.refused.${o.reason}`), tone: 'bad' })
  }

  const showTerms = (o: TermsOutcome, success: string) => {
    if (o.kind === 'signed') { setDone(true); setMessage({ text: t(success, { player: name }), tone: 'good' }) }
    else if (o.kind === 'counter') setMessage({ text: t('transfers.wageCounter', { player: name, wage: formatRM(o.wage) }), tone: 'info' })
    else if (o.kind === 'rejected') setMessage({ text: t('transfers.wageRejected', { player: name }), tone: 'bad' })
    else setMessage({ text: t(`transfers.refused.${o.reason}`), tone: 'bad' })
  }

  const contractForm = (send: () => void, button: string) => (
    <form onSubmit={(e) => { e.preventDefault(); send() }} noValidate className="deal">
      {agreed !== undefined && <p className="small muted">{t('transfers.feeAgreed', { fee: formatRM(agreed) })}</p>}
      <MoneyField label={t('transfers.offerWage')} value={wage} step={10} onChange={setWage} />
      <label className="field">
        <span className="small muted">{t('transfers.until')}</span>
        <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
          {yearOptions.map((o) => <option key={o.y} value={o.y}>{o.season}</option>)}
        </select>
      </label>
      <button className="primary" type="submit">{button}</button>
    </form>
  )

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal player-dialog" {...modal} aria-label={name}>
        <div className="dialog-head">
          <Avatar face={playerFace(p, state.clubs)} size={64} />
          <h2><span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span> {name}</h2>
          <strong className="ovr">{Math.round(overall(p))}</strong>
        </div>
        <dl className="kv">
          <dt>{t('transfers.club')}</dt><dd>{state.clubs[p.clubId]?.name ?? t('transfers.freeAgent')}</dd>
          <dt>{t('squad.age')}</dt><dd>{p.age}</dd>
          <dt>{t('transfers.value')}</dt><dd>{formatRM(playerValue(p, state.season))}</dd>
          <dt>{t('transfers.wage')}</dt><dd>{formatRM(p.wage)}</dd>
          {p.clubId !== FREE_AGENT && <><dt>{t('transfers.contract')}</dt><dd>{p.contractEnd}</dd></>}
        </dl>
        <ul className="attrs">
          {ATTRS.map((k) => <li key={k}><span>{t(`attr.${k}`)}</span><strong>{p.attrs[k]}</strong></li>)}
        </ul>
        <ScoutStars p={p} />
        {message && <p role="status" className={`deal-msg ${message.tone}`}>{message.text}</p>}
        {!done && !mine && !isFree && agreed === undefined && (
          <form onSubmit={sendBid} noValidate className="deal">
            <MoneyField label={t('transfers.yourBid')} value={fee} step={1000} onChange={setFee} />
            <button className="primary" type="submit" disabled={!open}>{t('transfers.makeBid')}</button>
            {!open && <p className="muted small">{t('transfers.refused.windowClosed')}</p>}
          </form>
        )}
        {!done && !mine && (isFree || agreed !== undefined) &&
          contractForm(() => showTerms(actions.terms(playerId, Number(wage), years), 'transfers.signed'), t('transfers.offerContract'))}
        {!done && mine && (yearOptions.length > 0
          ? contractForm(() => showTerms(actions.renew(playerId, Number(wage), years), 'transfers.renewed'), t('transfers.renew'))
          : <p className="muted small">{t('transfers.longest')}</p>)}
        {mine && !done && <button type="button" onClick={() => actions.list(playerId)}>{t(p.listed ? 'transfers.unlist' : 'transfers.list')}</button>}
        <button type="button" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  )
}

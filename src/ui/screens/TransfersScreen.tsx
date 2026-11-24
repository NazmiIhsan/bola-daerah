import { useMemo, useState } from 'react'
import { useT } from '../LanguageContext'
import { formatRM, wageBill } from '../../game/finance'
import { overall } from '../../game/generate'
import { playerValue, transferWindow, willJoin } from '../../game/market'
import { fullName } from '../../game/transfers'
import { FREE_AGENT, type GameState, type IncomingOffer, type Position } from '../../game/types'
import { PlayerDialog, type TransferActions } from '../components/PlayerDialog'
import { Avatar } from '../avatars/Avatar'
import { playerFace } from '../avatars/face'
import { ClubLabel } from '../components/bits'

export type { TransferActions } from '../components/PlayerDialog'

const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW']
const ROWS = 40
type Section = 'market' | 'offers' | 'done'
type Sort = 'ovr' | 'value' | 'age'

function Market({ state, onOpen }: { state: GameState; onOpen(id: string): void }) {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<Position | null>(null)
  const [maxAge, setMaxAge] = useState('')
  const [maxValue, setMaxValue] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [willingOnly, setWillingOnly] = useState(true)
  const [sort, setSort] = useState<Sort>('ovr')

  const all = useMemo(() => Object.values(state.players)
    .filter((p) => p.clubId !== state.userClubId)
    .map((p) => ({ p, name: fullName(p), ovr: overall(p), value: playerValue(p, state.season), willing: willJoin(state, p.id, state.userClubId) })), [state])

  const q = search.trim().toLowerCase()
  const found = all
    .filter((x) => (!q || x.name.toLowerCase().includes(q)) && (!pos || x.p.position === pos) &&
      (maxAge === '' || x.p.age <= Number(maxAge)) && (maxValue === '' || x.value <= Number(maxValue)) &&
      (!willingOnly || x.willing) && (!freeOnly || x.p.clubId === FREE_AGENT))
    .sort((a, b) => (sort === 'ovr' ? b.ovr - a.ovr : sort === 'value' ? b.value - a.value : a.p.age - b.p.age) || a.name.localeCompare(b.name))

  return (
    <>
      <div className="filters">
        <label className="field"><span className="small muted">{t('transfers.search')}</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="field"><span className="small muted">{t('transfers.maxAge')}</span><input type="number" min={15} value={maxAge} onChange={(e) => setMaxAge(e.target.value)} /></label>
        <label className="field"><span className="small muted">{t('transfers.maxValue')}</span><input type="number" min={0} step={10000} value={maxValue} onChange={(e) => setMaxValue(e.target.value)} /></label>
        <label className="field"><span className="small muted">{t('transfers.sort')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="ovr">{t('squad.ovr')}</option><option value="value">{t('transfers.value')}</option><option value="age">{t('squad.age')}</option>
          </select>
        </label>
      </div>
      <div className="row">
        <div className="chips" role="group" aria-label={t('squad.pos')}>
          {POSITIONS.map((x) => <button key={x} className={pos === x ? 'on' : ''} aria-pressed={pos === x} onClick={() => setPos(pos === x ? null : x)}>{t(`pos.${x}`)}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> {t('transfers.freeOnly')}</label>
        <label className="check"><input type="checkbox" checked={willingOnly} onChange={(e) => setWillingOnly(e.target.checked)} /> {t('transfers.willingOnly')}</label>
      </div>
      <p className="muted small">{t('transfers.showing', { n: Math.min(ROWS, found.length), total: found.length })}</p>
      {found.length === 0 ? <p>{t('transfers.none')}</p> : (
        <div className="market-list">
          {found.slice(0, ROWS).map(({ p, name, ovr, value }) => (
            <button key={p.id} className="market-row" aria-label={t('transfers.view', { player: name })} onClick={() => onOpen(p.id)}>
              <Avatar face={playerFace(p, state.clubs)} size={36} />
              <span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span>
              <span className="market-main">
                <span className="market-name">{name}</span>
                <span className="muted small">{p.clubId === FREE_AGENT ? t('transfers.freeAgent') : <ClubLabel state={state} id={p.clubId} />} · {t('transfers.ageShort', { n: p.age })}</span>
              </span>
              <span className="market-value small">{p.clubId === FREE_AGENT ? '' : formatRM(value)}</span>
              <strong className="ovr">{Math.round(ovr)}</strong>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function OfferItem({ state, offer, onAnswer }: { state: GameState; offer: IncomingOffer; onAnswer(a: 'accept' | 'reject' | 'negotiate'): void }) {
  const { t } = useT()
  const p = state.players[offer.playerId]
  const last = Math.min(offer.expires, state.matchday <= 3 ? 3 : 11)
  return (
    <li className="offer">
      <Avatar face={playerFace(p, state.clubs)} size={44} />
      <div className="offer-main">
        <strong>{fullName(p)}</strong> <span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span> <strong>{Math.round(overall(p))}</strong>
        <div className="small"><ClubLabel state={state} id={offer.clubId} /> · <strong>{formatRM(offer.fee)}</strong> <span className="muted">({t('transfers.value')} {formatRM(playerValue(p, state.season))})</span></div>
        <div className="muted small">{t('transfers.expires', { n: last })}</div>
      </div>
      <div className="row">
        <button className="primary" onClick={() => onAnswer('accept')}>{t('transfers.accept')}</button>
        <button disabled={offer.negotiated} onClick={() => onAnswer('negotiate')}>{t('transfers.negotiate')}</button>
        <button onClick={() => onAnswer('reject')}>{t('transfers.reject')}</button>
      </div>
    </li>
  )
}

export function TransfersScreen({ state, actions }: { state: GameState; actions: TransferActions }) {
  const { t } = useT()
  const [section, setSection] = useState<Section>('market')
  const [openId, setOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const me = state.userClubId
  const budget = state.transfers.budgets[me]
  const openWindow = transferWindow(state.matchday)
  const offers = state.transfers.offers
  const clubName = (id: string) => state.clubs[id]?.name ?? t('transfers.freeAgent')

  const answer = (offer: IncomingOffer, a: 'accept' | 'reject' | 'negotiate') => {
    const params = { player: fullName(state.players[offer.playerId]), club: clubName(offer.clubId), fee: formatRM(offer.fee) }
    const o = actions.respond(offer.id, a)
    if (o.kind === 'refused') setMessage(t(`transfers.refused.${o.reason}`))
    else if (o.kind === 'raised') setMessage(t('transfers.offerRaised', { ...params, fee: formatRM(o.fee) }))
    else setMessage(t(`transfers.offer.${o.kind}`, params))
  }

  return (
    <div className="card transfers">
      <h2>{t('transfers.title')}</h2>
      <p className={`banner ${openWindow ? 'open' : ''}`}>{t(openWindow ? `transfers.window.${openWindow}` : 'transfers.window.closed')}</p>
      <dl className="kv">
        <dt>{t('transfers.budget')}</dt><dd>{formatRM(budget.transfer)}</dd>
        <dt>{t('transfers.wages')}</dt><dd>{formatRM(wageBill(state, me))} / {formatRM(budget.wage)}</dd>
      </dl>
      <div className="chips" role="group" aria-label={t('transfers.title')}>
        {(['market', 'offers', 'done'] as Section[]).map((x) => (
          <button key={x} className={section === x ? 'on' : ''} aria-pressed={section === x} onClick={() => { setSection(x); setMessage(null) }}>
            {t(`transfers.section.${x}`, { n: offers.length })}
          </button>
        ))}
      </div>
      {message && <p role="status" className="deal-msg info">{message}</p>}
      {section === 'market' && <Market state={state} onOpen={setOpenId} />}
      {section === 'offers' && (offers.length === 0 ? <p className="muted">{t('transfers.noOffers')}</p> : (
        <ul className="offers">{offers.map((o) => <OfferItem key={o.id} state={state} offer={o} onAnswer={(a) => answer(o, a)} />)}</ul>
      ))}
      {section === 'done' && (state.transfers.history.length === 0 ? <p className="muted">{t('transfers.noDeals')}</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th className="left">{t('squad.name')}</th><th className="left">{t('transfers.from')}</th><th className="left">{t('transfers.to')}</th><th>{t('transfers.fee')}</th><th>{t('transfers.when')}</th></tr></thead>
            <tbody>
              {state.transfers.history.map((r, i) => (
                <tr key={i} className={r.fromId === me || r.toId === me ? 'me' : ''}>
                  <td className="left">{r.name}</td><td className="left">{clubName(r.fromId)}</td><td className="left">{clubName(r.toId)}</td>
                  <td>{r.fee ? formatRM(r.fee) : t('transfers.free')}</td><td>{r.season} · {r.matchday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {openId && <PlayerDialog key={openId} state={state} playerId={openId} actions={actions} onClose={() => setOpenId(null)} />}
    </div>
  )
}

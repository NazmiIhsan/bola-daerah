import { useEffect, useState } from 'react'
import './theme.css'
import { LanguageProvider, useT } from './LanguageContext'
import { useGame, type GameApi } from './useGame'
import { StartScreen } from './screens/StartScreen'
import { NewGameScreen } from './screens/NewGameScreen'
import { Dashboard } from './screens/Dashboard'
import { SquadScreen } from './screens/SquadScreen'
import { TableScreen } from './screens/TableScreen'
import { FixturesScreen } from './screens/FixturesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TacticsScreen } from './screens/TacticsScreen'
import { MatchScreen } from './screens/MatchScreen'
import { InboxScreen } from './screens/InboxScreen'
import { ClubScreen } from './screens/ClubScreen'
import { PressScreen } from './screens/PressScreen'
import { TransfersScreen } from './screens/TransfersScreen'
import { SackedScreen } from './screens/SackedScreen'
import { unreadCount } from '../game/news'
import { Kit, ClubLabel } from './components/bits'
import { isSeasonOver } from '../game/season'

type Tab = 'home' | 'inbox' | 'club' | 'squad' | 'transfers' | 'tactics' | 'table' | 'fixtures' | 'settings'
const TABS: Array<{ id: Tab; icon: string }> = [
  { id: 'home', icon: '🏠' },
  { id: 'inbox', icon: '📰' },
  { id: 'club', icon: '🏟️' },
  { id: 'squad', icon: '👥' },
  { id: 'transfers', icon: '🔁' },
  { id: 'tactics', icon: '📋' },
  { id: 'table', icon: '📊' },
  { id: 'fixtures', icon: '📅' },
  { id: 'settings', icon: '⚙️' },
]

function SeasonSummaryModal({ game }: { game: GameApi }) {
  const { t } = useT()
  const s = game.state!
  const sum = game.summary!
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={t('season.summary', { season: sum.season })}>
      <div className="modal">
        <h2>{t('season.summary', { season: sum.season })}</h2>
        <p><strong>{t('season.champions')}:</strong> {t('common.division', { n: 1 })} <ClubLabel state={s} id={sum.champions[0]} /> · {t('common.division', { n: 2 })} <ClubLabel state={s} id={sum.champions[1]} /></p>
        <p><strong>⬆ {t('season.promoted')}:</strong> {sum.promoted.map((id) => <ClubLabel key={id} state={s} id={id} />)}</p>
        <p><strong>⬇ {t('season.relegated')}:</strong> {sum.relegated.map((id) => <ClubLabel key={id} state={s} id={id} />)}</p>
        <button className="primary" onClick={game.clearSummary}>{t('common.continue')}</button>
      </div>
    </div>
  )
}

function GameShell({ game }: { game: GameApi }) {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('home')
  const [inMatch, setInMatch] = useState(false)
  const s = game.state!
  const club = s.clubs[s.userClubId]
  const div = s.divisions.find((d) => d.clubIds.includes(s.userClubId))!.id
  return (
    <div className="shell">
      <header className="topbar" role="banner" style={{ borderColor: club.colors[0] }}>
        <Kit colors={club.colors} size={32} />
        <div>
          <div className="club-title">{club.name}</div>
          <div className="muted small">
            {t('common.division', { n: div })} · {t('common.season', { season: s.season })}
            {!isSeasonOver(s) && <> · {t('common.matchday', { n: s.matchday })}</>}
          </div>
        </div>
      </header>
      {!game.storageOk && <p className="banner warn">{t('storage.unavailable')}</p>}
      {s.career.kind === 'sacked' ? (
        <main className="content full">
          <SackedScreen state={s} onTakeJob={(id) => { game.takeJob(id); setTab('home') }} onNewGame={() => void game.quit()} />
        </main>
      ) : s.press && !inMatch ? (
        <main className="content full">
          <PressScreen
            key={s.press.fixtureId + s.press.kind}
            press={s.press}
            state={s}
            onSubmit={(a) => { const pre = s.press!.kind === 'pre'; game.answerPress(a); if (pre) setInMatch(true) }}
            onSkip={() => { const pre = s.press!.kind === 'pre'; game.skipPress(); if (pre) setInMatch(true) }}
          />
        </main>
      ) : inMatch ? (
        <main className="content full">
          <MatchScreen state={s} onFinish={(m) => { setInMatch(false); game.continueDay(m) }} />
        </main>
      ) : (<>
      <nav className="nav" aria-label="Main">
        {TABS.map((x) => (
          <button key={x.id} className={tab === x.id ? 'on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => setTab(x.id)}>
            <span aria-hidden className="icon">{x.icon}</span>
            <span className="label">{t(`nav.${x.id}`)}</span>
            {x.id === 'transfers' && s.transfers.offers.length > 0 && <span className="badge">{s.transfers.offers.length}</span>}
            {x.id === 'inbox' && unreadCount(s) > 0 && <span className="badge" aria-label={`${unreadCount(s)} unread`}>{unreadCount(s)}</span>}
          </button>
        ))}
      </nav>
      <main className="content">
        {tab === 'home' && <Dashboard game={game} onPlayMatch={() => { const ns = game.beginMatch(); if (ns && !ns.press) setInMatch(true) }} />}
        {tab === 'inbox' && <InboxScreen state={s} onRead={game.markRead} />}
        {tab === 'club' && <ClubScreen state={s} />}
        {tab === 'squad' && <SquadScreen state={s} actions={game.transfers} />}
        {tab === 'transfers' && <TransfersScreen state={s} actions={game.transfers} />}
        {tab === 'tactics' && <TacticsScreen state={s} onChange={game.setTactics} />}
        {tab === 'table' && <TableScreen state={s} />}
        {tab === 'fixtures' && <FixturesScreen state={s} />}
        {tab === 'settings' && <SettingsScreen game={game} />}
      </main>
      </>)}
      {game.summary && <SeasonSummaryModal game={game} />}
    </div>
  )
}

function Root() {
  const game = useGame()
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    if (game.state) setCreating(false)
  }, [game.state])
  if (game.state) return <GameShell game={game} />
  if (creating) return <NewGameScreen game={game} onBack={() => setCreating(false)} />
  return <StartScreen game={game} onNew={() => setCreating(true)} />
}

export function App() {
  return (
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  )
}

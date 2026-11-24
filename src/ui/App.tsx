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
import { Nav, type Tab } from './components/Nav'
import { SeasonSummary } from './components/SeasonSummary'
import { YouthScreen } from './screens/YouthScreen'
import { Kit } from './components/bits'
import { isSeasonOver } from '../game/season'

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
      <Nav tab={tab} onTab={setTab} badges={{ transfers: s.transfers.offers.length, youth: s.youth.intake.length, inbox: unreadCount(s) }} />
      <main className="content">
        {tab === 'home' && <Dashboard game={game} onPlayMatch={() => { const ns = game.beginMatch(); if (ns && !ns.press) setInMatch(true) }} />}
        {tab === 'inbox' && <InboxScreen state={s} onRead={game.markRead} onReadAll={game.markAllRead} />}
        {tab === 'club' && <ClubScreen state={s} />}
        {tab === 'squad' && <SquadScreen state={s} actions={game.transfers} />}
        {tab === 'transfers' && <TransfersScreen state={s} actions={game.transfers} />}
        {tab === 'youth' && <YouthScreen state={s} actions={game.youth} />}
        {tab === 'tactics' && <TacticsScreen state={s} onChange={game.setTactics} />}
        {tab === 'table' && <TableScreen state={s} />}
        {tab === 'fixtures' && <FixturesScreen state={s} />}
        {tab === 'settings' && <SettingsScreen game={game} />}
      </main>
      </>)}
      {game.summary && <SeasonSummary state={s} summary={game.summary} onClose={game.clearSummary} />}
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

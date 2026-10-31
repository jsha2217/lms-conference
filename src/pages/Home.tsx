import { useLocation, useNavigate } from 'react-router-dom'
import AchieverBanner from '../components/AchieverBanner'
import TeamPanel from '../components/TeamPanel'
import TeamSheet from '../components/TeamSheet'
import { teamScore, useScores } from '../hooks/useScores'
import { TEAMS, type Team } from '../lib/types'
import './Home.css'

export default function Home() {
  const { scores, loading, error } = useScores()
  const location = useLocation()
  const navigate = useNavigate()

  // /team/1 처럼 주소로 열어서 뒤로가기로 닫히게 한다
  const match = location.pathname.match(/^\/team\/([12])$/)
  const openTeam = match ? (Number(match[1]) as Team) : null
  // 모바일(한 줄 배치)에서는 점수 높은 팀이 위로. 동점이면 1팀 먼저. DOM 순서는 유지해 나무 영상이 재생성되지 않게 한다.
  const ranked = [...TEAMS].sort((a, b) => teamScore(scores, b) - teamScore(scores, a) || a - b)

  const open = (team: Team) => navigate(`/team/${team}`, { state: { fromHome: true } })
  const close = () => {
    if (!openTeam) return
    if (location.state?.fromHome) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <>
      <AchieverBanner scores={scores} />
      <main className="container home">
        {error && <p className="error-text home-error">데이터를 불러오지 못했습니다: {error}</p>}
        <div className="home-teams">
          {loading
            ? TEAMS.map((t) => <div key={t} className="glass home-skeleton" />)
            : TEAMS.map((t) => (
                <TeamPanel
                  key={t}
                  team={t}
                  members={scores.filter((s) => s.team === t)}
                  mobileOrder={ranked.indexOf(t)}
                  onOpen={() => open(t)}
                />
              ))}
        </div>
      </main>
      <TeamSheet team={openTeam} members={openTeam ? scores.filter((s) => s.team === openTeam) : []} onClose={close} />
    </>
  )
}

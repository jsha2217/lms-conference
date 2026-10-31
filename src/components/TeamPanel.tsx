import type { CSSProperties } from 'react'
import { ACHIEVE_STEPS, teamLabel, type MemberScore, type Team } from '../lib/types'
import GrowthTree from './GrowthTree'
import './TeamPanel.css'

export function StepPips({ steps }: { steps: number }) {
  return (
    <span className="pips" aria-label={`${steps}단계`}>
      {Array.from({ length: ACHIEVE_STEPS }, (_, i) => (
        <i key={i} className={i < steps ? 'on' : ''} />
      ))}
      {steps > ACHIEVE_STEPS && <em>+{steps - ACHIEVE_STEPS}</em>}
    </span>
  )
}

export default function TeamPanel({
  team,
  members,
  mobileOrder,
  onOpen,
}: {
  team: Team
  members: MemberScore[]
  mobileOrder: number
  onOpen: () => void
}) {
  const total = members.reduce((sum, m) => sum + m.score, 0)
  const achieved = members.filter((m) => m.steps >= ACHIEVE_STEPS).length

  return (
    <section
      className={`team-panel glass team-${team}`}
      style={{ '--mobile-order': mobileOrder } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`${teamLabel(team)} 맴버 단계 이수 현황 보기`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <header className="team-head">
        <h2>{teamLabel(team)}</h2>
        <div className="team-score">
          <b>{total}</b>
          <span>점</span>
        </div>
      </header>

      <GrowthTree team={team} score={total} />

      <footer className="team-foot">
        <span>
          맴버 {members.length}명 · 목표 달성 {achieved}명
        </span>
        <span className="team-more">
          이수 현황 보기
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5L10.5 8 6 12.5" />
          </svg>
        </span>
      </footer>
    </section>
  )
}

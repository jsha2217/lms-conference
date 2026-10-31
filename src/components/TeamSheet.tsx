import { useEffect, useRef } from 'react'
import { ACHIEVE_STEPS, teamLabel, type MemberScore, type Team } from '../lib/types'
import { StepPips } from './TeamPanel'
import './TeamSheet.css'

// 팀 맴버별 단계 이수 현황. 데스크톱은 가운데 창, 모바일은 아래에서 올라오는 시트.
export default function TeamSheet({ team, members, onClose }: { team: Team | null; members: MemberScore[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (team && !dialog.open) {
      dialog.showModal()
      // 닫기 버튼 대신 제목에 포커스 (포커스 링 없이 열리고, 스크린리더는 제목부터 읽음)
      dialog.querySelector<HTMLElement>('#team-sheet-title')?.focus()
    }
    if (!team && dialog.open) dialog.close()
  }, [team])

  const sorted = [...members].sort((a, b) => b.steps - a.steps || a.name.localeCompare(b.name, 'ko'))
  const total = members.reduce((sum, m) => sum + m.score, 0)
  const achieved = members.filter((m) => m.steps >= ACHIEVE_STEPS).length

  return (
    <dialog
      ref={ref}
      className={`team-sheet${team ? ` team-${team}` : ''}`}
      aria-labelledby="team-sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {team && (
        <div className="team-sheet-body glass">
          <header className="team-sheet-head">
            <h2 id="team-sheet-title" tabIndex={-1}>{teamLabel(team)} 단계 이수 현황</h2>
            <button className="team-sheet-close" onClick={onClose} aria-label="닫기">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </header>

          <dl className="team-sheet-summary">
            <div>
              <dt>팀 점수</dt>
              <dd>{total}점</dd>
            </div>
            <div>
              <dt>맴버</dt>
              <dd>{members.length}명</dd>
            </div>
            <div>
              <dt>목표 달성</dt>
              <dd>{achieved}명</dd>
            </div>
          </dl>

          {sorted.length === 0 ? (
            <p className="team-sheet-empty muted">등록된 맴버가 없습니다</p>
          ) : (
            <ul className="team-sheet-list">
              {sorted.map((m) => (
                <li key={m.id} className={m.steps >= ACHIEVE_STEPS ? 'is-achieved' : ''}>
                  <div className="ts-name">
                    {m.name}
                    {m.steps >= ACHIEVE_STEPS && <span className="badge badge-achieved">목표 달성</span>}
                  </div>
                  <StepPips steps={m.steps} />
                  <div className="ts-nums">
                    <span>
                      <b>{m.steps}</b>단계
                    </span>
                    <span>
                      <b>{m.score}</b>점
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </dialog>
  )
}

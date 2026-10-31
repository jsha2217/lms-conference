import { useMemo, useState, type CSSProperties } from 'react'
import { ACHIEVE_STEPS, teamLabel, type MemberScore } from '../lib/types'
import './AchieverBanner.css'

// 활성 인디케이터가 차오르는 시간 = 한 사람이 보이는 시간. 차오름이 끝나면 다음 사람으로 넘어간다.
const ROTATE_MS = 4000

const formatDate = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function AchieverBanner({ scores }: { scores: MemberScore[] }) {
  // 최근 달성자부터
  const achievers = useMemo(
    () =>
      scores
        .filter((s) => s.steps >= ACHIEVE_STEPS)
        .sort((a, b) => (b.achieved_at ?? '').localeCompare(a.achieved_at ?? '')),
    [scores],
  )
  const [index, setIndex] = useState(0)
  const current = achievers.length ? index % achievers.length : 0
  const next = () => setIndex((i) => (i + 1) % achievers.length)

  return (
    <section className="achievers" aria-label="목표 달성자">
      <div className="container">
        <div className="achievers-head">
          <span className="achievers-title">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.5l2.5 5.4 5.9.7-4.4 4 1.2 5.8L10 14.5l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7z" />
            </svg>
            목표 달성자
          </span>
          <span className="achievers-count">{achievers.length}명</span>
        </div>

        {achievers.length === 0 ? (
          <div className="achiever-card achiever-empty glass">첫 번째 달성자를 기다리고 있어요</div>
        ) : (
          <div className="achievers-stage">
            {achievers.map((a, i) => (
              <article key={a.id} className={`achiever-slide${i === current ? ' is-active' : ''}`} aria-hidden={i !== current}>
                <div className="achiever-card glass">
                  <div className="achiever-medal" aria-hidden="true">
                    {a.name.slice(0, 1)}
                  </div>
                  <div className="achiever-info">
                    <div className="achiever-name">{a.name}</div>
                    <div className="achiever-meta">
                      <span className={`badge badge-team-${a.team}`}>{teamLabel(a.team)}</span>
                      <span className="muted">{formatDate(a.achieved_at)} 달성</span>
                    </div>
                  </div>
                  <div className="achiever-stats">
                    <div>
                      <b>{a.steps}</b>
                      <span>단계</span>
                    </div>
                    <div>
                      <b>{a.score}</b>
                      <span>점</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {achievers.length > 1 && (
          <div className="achievers-dots" role="tablist">
            {achievers.map((a, i) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={i === current}
                aria-label={`${a.name}`}
                className={i === current ? 'is-active' : ''}
                style={{ '--rotate-ms': `${ROTATE_MS}ms` } as CSSProperties}
                onClick={() => setIndex(i)}
                onAnimationEnd={i === current ? next : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { TREE_FULL_SCORE, type Team } from '../lib/types'
import './GrowthTree.css'

// 성장 영상(씨앗 → 만개, 4:3, 전 프레임 키프레임). null이면 코드로 그린 나무를 쓴다.
const TREE_VIDEOS: Record<Team, string | null> = {
  1: `${import.meta.env.BASE_URL}img/tree-team1.mp4`,
  2: `${import.meta.env.BASE_URL}img/tree-team2.mp4`,
}

const PALETTES: Record<Team, string[]> = {
  1: ['#ffffff', '#c9ecff', '#8fd3ff', '#ffe7a3'],
  2: ['#ffffff', '#e8dbff', '#c6adff', '#ffd6e6'],
}

interface Branch {
  d: string
  width: number
  t0: number
  t1: number
}

interface Bloom {
  x: number
  y: number
  r: number
  t: number
  color: number
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 가지마다 성장 구간 [t0, t1](0~1)을 부여한다. 진행률 p에 따라 그 구간만큼 그려진다.
function buildTree(seed: number) {
  const rand = mulberry32(seed)
  const branches: Branch[] = []
  const blooms: Bloom[] = []
  const MAX_DEPTH = 6
  const UP = -Math.PI / 2
  let minX = Infinity, maxX = -Infinity, minY = Infinity

  const grow = (x: number, y: number, angle: number, len: number, width: number, depth: number, t0: number) => {
    const dur = depth === 0 ? 0.2 : 0.12
    const t1 = t0 + dur
    const ex = x + Math.cos(angle) * len
    const ey = y + Math.sin(angle) * len
    const bend = (rand() - 0.5) * len * 0.4
    const cx = (x + ex) / 2 + Math.cos(angle + Math.PI / 2) * bend
    const cy = (y + ey) / 2 + Math.sin(angle + Math.PI / 2) * bend
    branches.push({ d: `M${x.toFixed(1)} ${y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, width, t0, t1 })
    minX = Math.min(minX, ex)
    maxX = Math.max(maxX, ex)
    minY = Math.min(minY, ey)

    if (depth >= 3) {
      // 잎/꽃: 가지 끝 근처에 흩뿌리고 후반부(0.62~1)에 피어난다
      const count = depth === MAX_DEPTH ? 3 : 1
      for (let i = 0; i < count; i++) {
        blooms.push({
          x: ex + (rand() - 0.5) * 18,
          y: ey + (rand() - 0.5) * 18,
          r: 2 + rand() * (depth === MAX_DEPTH ? 4.5 : 3),
          t: Math.max(t1, 0.62) + rand() * (1 - Math.max(t1, 0.62)) * 0.92,
          color: Math.floor(rand() * 4),
        })
      }
    }
    if (depth >= MAX_DEPTH) return

    const n = depth < 2 ? 3 : rand() < 0.12 ? 1 : 2
    const spread = 0.42 + rand() * 0.22
    for (let i = 0; i < n; i++) {
      let a = angle + (i - (n - 1) / 2) * spread + (rand() - 0.5) * 0.25
      a = a * 0.86 + UP * 0.14 // 위쪽으로 살짝 끌어당겨 수관 모양 유지
      grow(ex, ey, a, len * (0.7 + rand() * 0.12), width * 0.66, depth + 1, t0 + dur * 0.72 + rand() * 0.03)
    }
  }

  const baseY = 400
  grow(200, baseY, UP, 82, 15, 0, 0.02)
  const pad = 26
  const left = Math.min(minX - pad, 200 - 150)
  const right = Math.max(maxX + pad, 200 + 150)
  const top = minY - pad
  return { branches, blooms, viewBox: `${left.toFixed(0)} ${top.toFixed(0)} ${(right - left).toFixed(0)} ${(baseY + 40 - top).toFixed(0)}` }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// 점수 변화를 부드럽게 따라가는 표시용 점수. 마지막으로 본 점수부터 자라기 시작한다.
function useTweenedScore(target: number, storageKey: string) {
  const [value, setValue] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey))
      return Number.isFinite(saved) ? Math.min(saved, target) : 0
    } catch {
      return 0
    }
  })
  const valueRef = useRef(value)

  useEffect(() => {
    const from = valueRef.current
    const to = target
    if (from === to) return
    const duration = Math.min(3200, Math.max(700, Math.abs(to - from) * 260))
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const k = clamp01((now - start) / duration)
      const v = from + (to - from) * easeInOut(k)
      valueRef.current = v
      setValue(v)
      if (k < 1) frame = requestAnimationFrame(tick)
      else {
        try {
          localStorage.setItem(storageKey, String(to))
        } catch {
          /* 저장 불가 환경은 무시 */
        }
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, storageKey])

  return value
}

// 영상 모드: 점수가 오르면 그 구간을 실제로 재생해서 자라게 하고, 내려가면 짧게 되감는다.
function useVideoGrowth(ref: RefObject<HTMLVideoElement | null>, score: number, startScore: number, enabled: boolean) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const v = ref.current
    if (!v || !enabled) return
    // iOS Safari는 재생 전엔 프레임을 불러오지 않아 currentTime만 바꾸면 빈 화면이 된다.
    // 프레임 데이터가 없으면 무음 재생을 잠깐 걸어 프레임을 받은 뒤 원하는 위치로 이동한다.
    const onMeta = () => {
      const finish = () => {
        v.currentTime = toVideoTime(startScore, v.duration)
        setReady(true)
      }
      if (v.readyState >= 2) return finish()
      v.play().then(
        () => {
          v.pause()
          finish()
        },
        finish, // 저전력 모드 등 자동재생 불가: 그대로 이동 (#t 프래그먼트로 프레임은 받아둠)
      )
    }
    if (v.readyState >= 1) onMeta()
    else v.addEventListener('loadedmetadata', onMeta, { once: true })
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [ref, enabled, startScore])

  useEffect(() => {
    const v = ref.current
    if (!v || !ready) return
    const from = v.currentTime
    const to = toVideoTime(score, v.duration)
    let frame = 0
    if (Math.abs(to - from) < 0.02 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause()
      v.currentTime = to
      return
    }

    if (to > from) {
      const points = ((to - from) / v.duration) * TREE_FULL_SCORE
      const seconds = Math.min(3.2, Math.max(0.9, points * 0.26))
      const stop = () => {
        v.pause()
        v.currentTime = to
      }
      v.playbackRate = Math.min(8, Math.max(0.25, (to - from) / seconds))
      v.play().catch(stop)
      const tick = () => {
        if (v.currentTime >= to - 0.02) stop()
        else frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    } else {
      v.pause()
      const start = performance.now()
      const tick = (now: number) => {
        const k = clamp01((now - start) / 700)
        v.currentTime = from + (to - from) * easeInOut(k)
        if (k < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    return () => {
      cancelAnimationFrame(frame)
      v.pause()
    }
  }, [ref, ready, score])
}

// 끝 프레임에 닿으면 play()가 처음부터 재생되므로 살짝 앞에서 멈춘다
const toVideoTime = (score: number, duration: number) => clamp01(score / TREE_FULL_SCORE) * (duration - 0.05)

interface Burst {
  id: number
  delta: number
}

export default function GrowthTree({ team, score }: { team: Team; score: number }) {
  const shown = useTweenedScore(score, `lms-tree-seen-${team}`)
  const p = clamp01(shown / TREE_FULL_SCORE)
  const tree = useMemo(() => buildTree(team === 1 ? 7 : 31), [team])
  const palette = PALETTES[team]
  const videoSrc = TREE_VIDEOS[team]
  const videoRef = useRef<HTMLVideoElement>(null)
  const startScore = useRef(shown).current
  useVideoGrowth(videoRef, score, startScore, !!videoSrc)

  // 점수가 오르면 +N 표시
  const [bursts, setBursts] = useState<Burst[]>([])
  const prevScore = useRef(score)
  useEffect(() => {
    const delta = score - prevScore.current
    prevScore.current = score
    if (delta <= 0) return
    const id = Date.now()
    setBursts((b) => [...b, { id, delta }])
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2200)
  }, [score])

  const full = p >= 1
  const auraOpacity = clamp01((p - 0.7) / 0.3)

  return (
    <div className={`growth-tree team-${team}${full ? ' is-full' : ''}${videoSrc ? ' has-video' : ''}`}>
      {videoSrc ? (
        <video
          ref={videoRef}
          className="growth-tree-video"
          src={`${videoSrc}#t=0.001`}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-label={`${team}팀 성장 나무`}
        />
      ) : (
        <svg className="growth-tree-svg" viewBox={tree.viewBox} role="img" aria-label={`${team}팀 성장 나무`}>
          <defs>
            <radialGradient id={`aura-${team}`}>
              <stop offset="0%" stopColor={palette[2]} stopOpacity="0.55" />
              <stop offset="60%" stopColor={palette[1]} stopOpacity="0.18" />
              <stop offset="100%" stopColor={palette[1]} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`seed-${team}`}>
              <stop offset="0%" stopColor="#fff8dc" />
              <stop offset="100%" stopColor="#ffe08a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`bark-${team}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#f3d98f" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <filter id={`glow-${team}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle className="growth-tree-aura" cx="200" cy="190" r="210" fill={`url(#aura-${team})`} opacity={auraOpacity} />

          {/* 구름 받침 */}
          <g className="growth-tree-cloud">
            <ellipse cx="200" cy="408" rx="140" ry="20" />
            <ellipse cx="150" cy="400" rx="60" ry="16" />
            <ellipse cx="255" cy="402" rx="70" ry="15" />
          </g>

          <circle cx="200" cy="398" r={18 + 10 * (1 - p)} fill={`url(#seed-${team})`} opacity={0.5 + 0.5 * (1 - p)} />

          <g filter={`url(#glow-${team})`} stroke={`url(#bark-${team})`} fill="none" strokeLinecap="round">
            {tree.branches.map((b, i) => {
              const f = clamp01((p - b.t0) / (b.t1 - b.t0))
              if (f <= 0) return null
              return <path key={i} d={b.d} strokeWidth={b.width} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - f} />
            })}
          </g>

          <g filter={`url(#glow-${team})`}>
            {tree.blooms.map((b, i) => {
              const f = clamp01((p - b.t) / 0.06)
              if (f <= 0) return null
              return <circle key={i} cx={b.x} cy={b.y} r={b.r * f} fill={palette[b.color]} opacity={0.35 + 0.6 * f} />
            })}
          </g>
        </svg>
      )}

      {bursts.map((b) => (
        <span key={b.id} className="growth-tree-burst">
          +{b.delta}
        </span>
      ))}
    </div>
  )
}

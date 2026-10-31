import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { StepPips } from '../components/TeamPanel'
import { useAuth } from '../hooks/useAuth'
import { useScores } from '../hooks/useScores'
import { supabase } from '../lib/supabase'
import { ACHIEVE_STEPS, TEAMS, teamLabel, type MemberScore, type Team } from '../lib/types'
import './Admin.css'

type Tab = 'commit' | 'history' | 'members'

const nextScore = (m: MemberScore) => {
  const steps = m.steps + 1
  return m.role === 'lead' && steps >= ACHIEVE_STEPS ? 10 : steps
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => setMessage(null), 2400)
    return () => window.clearTimeout(t)
  }, [message])
  return [message, setMessage] as const
}

export default function Admin() {
  const { me, loading: authLoading } = useAuth()
  const { scores, refresh } = useScores()
  const [tab, setTab] = useState<Tab>('commit')
  const [pickedTeam, setPickedTeam] = useState<Team>(1)
  const [toast, setToast] = useToast()

  if (authLoading) return <main className="container admin" />
  if (!me || (me.role !== 'lead' && me.role !== 'admin')) return <Navigate to="/login" replace />

  const isAdmin = me.role === 'admin'
  const team: Team = isAdmin ? pickedTeam : (me.team as Team)
  const people = scores.filter((s) => s.team === team)
  const done = (msg: string) => {
    setToast(msg)
    refresh()
  }

  return (
    <main className="container admin">
      <div className="admin-head">
        <div>
          <h1>{teamLabel(team)} 관리</h1>
          <p className="muted">{isAdmin ? '총괄 계정은 양 팀 모두 관리할 수 있습니다.' : '자기 팀만 관리할 수 있습니다.'}</p>
        </div>
        {isAdmin && (
          <div className="segmented">
            {TEAMS.map((t) => (
              <button key={t} className={t === team ? 'is-active' : ''} onClick={() => setPickedTeam(t)}>
                {teamLabel(t)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['commit', '통과 커밋'],
            ['history', '커밋 내역'],
            ['members', '팀원 관리'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <section className="glass admin-body">
        {tab === 'commit' && <CommitTab key={team} people={people} onDone={done} />}
        {tab === 'history' && <HistoryTab team={team} scores={scores} onDone={done} />}
        {tab === 'members' && <MembersTab team={team} isAdmin={isAdmin} people={people} onDone={done} />}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}

/* ───────────── 통과 커밋 ───────────── */

function CommitTab({ people, onDone }: { people: MemberScore[]; onDone: (msg: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sorted = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [people])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const commit = async () => {
    const targets = sorted.filter((p) => selected.has(p.id))
    if (!targets.length) return
    if (!window.confirm(`${targets.map((t) => t.name).join(', ')}\n\n${targets.length}명의 LMS 단계 통과를 등록할까요?`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('passes').insert(targets.map((t) => ({ member_id: t.id })))
    setBusy(false)
    if (error) return setError(error.message)
    setSelected(new Set())
    onDone(`${targets.length}명 통과 등록 완료`)
  }

  if (!sorted.length) return <p className="admin-empty muted">팀원을 먼저 등록해 주세요.</p>

  return (
    <>
      <p className="admin-hint">이번에 LMS 단계를 통과한 사람을 체크하고 커밋하세요. 1명당 1단계가 올라갑니다.</p>
      <ul className="commit-list">
        {sorted.map((p) => {
          const on = selected.has(p.id)
          return (
            <li key={p.id}>
              <label className={on ? 'is-on' : ''}>
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                <span className="commit-check" aria-hidden="true" />
                <span className="commit-name">
                  {p.name}
                </span>
                <StepPips steps={on ? p.steps + 1 : p.steps} />
                <span className="commit-score">
                  {on ? (
                    <>
                      {p.score} → <b>{nextScore(p)}</b>점
                    </>
                  ) : (
                    <>
                      <b>{p.score}</b>점
                    </>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {error && <p className="error-text">{error}</p>}
      <div className="commit-bar glass">
        <button className="btn btn-quiet btn-sm" onClick={() => setSelected(selected.size === sorted.length ? new Set() : new Set(sorted.map((p) => p.id)))}>
          {selected.size === sorted.length ? '전체 해제' : '전체 선택'}
        </button>
        <span className="muted">{selected.size}명 선택</span>
        <button className="btn btn-gold" disabled={busy || selected.size === 0} onClick={commit}>
          {busy ? '등록 중…' : '커밋'}
        </button>
      </div>
    </>
  )
}

/* ───────────── 커밋 내역 / 취소 ───────────── */

interface PassRow {
  id: number
  created_at: string
  member: { name: string; team: Team; role: string }
  committer: { name: string } | null
}

function HistoryTab({ team, scores, onDone }: { team: Team; scores: MemberScore[]; onDone: (msg: string) => void }) {
  const [rows, setRows] = useState<PassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('passes')
      .select('id, created_at, member:members!passes_member_id_fkey!inner(name, team, role), committer:members!passes_committed_by_fkey(name)')
      .eq('member.team', team)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) setError(error.message)
    else setRows(data as unknown as PassRow[])
    setLoading(false)
  }, [team])

  // scores가 실시간으로 갱신되면 내역도 다시 읽는다
  useEffect(() => {
    load()
  }, [load, scores])

  const cancel = async (row: PassRow) => {
    if (!window.confirm(`${row.member.name}님의 통과 1건(${formatDateTime(row.created_at)})을 취소할까요?`)) return
    const { error } = await supabase.from('passes').delete().eq('id', row.id)
    if (error) return setError(error.message)
    onDone('커밋을 취소했습니다')
  }

  if (loading) return <p className="admin-empty muted">불러오는 중…</p>
  if (!rows.length) return <p className="admin-empty muted">아직 커밋 내역이 없습니다.</p>

  return (
    <>
      {error && <p className="error-text">{error}</p>}
      <ul className="history-list">
        {rows.map((r) => (
          <li key={r.id}>
            <span className="history-time">{formatDateTime(r.created_at)}</span>
            <span className="history-name">
              <b>{r.member.name}</b> 통과 +1
            </span>
            <span className="history-by muted">by {r.committer?.name ?? '알 수 없음'}</span>
            <button className="btn btn-danger btn-sm" onClick={() => cancel(r)}>
              취소
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ───────────── 팀원 관리 ───────────── */

function MembersTab({
  team,
  isAdmin,
  people,
  onDone,
}: {
  team: Team
  isAdmin: boolean
  people: MemberScore[]
  onDone: (msg: string) => void
}) {
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string; team: Team } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sorted = useMemo(
    () => [...people].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'ko') : a.role === 'lead' ? -1 : 1)),
    [people],
  )

  const nameTaken = (name: string, exceptId?: string) => people.some((p) => p.name === name && p.id !== exceptId)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (nameTaken(name)) return setError(`이미 ${teamLabel(team)}에 ${name}님이 있습니다.`)
    setError(null)
    const { error } = await supabase.from('members').insert({ name, team, role: 'member' })
    if (error) return setError(error.message)
    setNewName('')
    onDone(`${name}님을 추가했습니다`)
  }

  const save = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) return
    if (editing.team === team && nameTaken(name, editing.id)) return setError(`이미 ${teamLabel(team)}에 ${name}님이 있습니다.`)
    setError(null)
    const patch = isAdmin ? { name, team: editing.team } : { name }
    const { error } = await supabase.from('members').update(patch).eq('id', editing.id)
    if (error) return setError(error.message)
    setEditing(null)
    onDone('수정했습니다')
  }

  const remove = async (m: MemberScore) => {
    const extra = m.steps ? `\n통과 기록 ${m.steps}건도 함께 삭제됩니다.` : ''
    if (!window.confirm(`${m.name}님을 삭제할까요?${extra}`)) return
    const { error } = await supabase.from('members').delete().eq('id', m.id)
    if (error) return setError(error.message)
    onDone(`${m.name}님을 삭제했습니다`)
  }

  return (
    <>
      <form className="member-add" onSubmit={add}>
        <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`${teamLabel(team)}에 추가할 이름`} maxLength={30} />
        <button className="btn btn-primary" disabled={!newName.trim()}>
          추가
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <ul className="member-list">
        {sorted.map((m) => {
          const isEditing = editing?.id === m.id
          return (
            <li key={m.id}>
              {isEditing ? (
                <>
                  <input
                    className="input input-sm"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    maxLength={30}
                    autoFocus
                  />
                  {isAdmin && (
                    <select className="input input-sm" value={editing.team} onChange={(e) => setEditing({ ...editing, team: Number(e.target.value) as Team })}>
                      {TEAMS.map((t) => (
                        <option key={t} value={t}>
                          {teamLabel(t)}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="member-actions">
                    <button className="btn btn-primary btn-sm" onClick={save}>
                      저장
                    </button>
                    <button className="btn btn-quiet btn-sm" onClick={() => setEditing(null)}>
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="member-name">
                    {m.name}
                  </span>
                  <span className="muted member-steps">
                    {m.steps}단계 · {m.score}점
                  </span>
                  {m.role === 'member' && (
                    <div className="member-actions">
                      <button className="btn btn-quiet btn-sm" onClick={() => setEditing({ id: m.id, name: m.name, team })}>
                        수정
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>
                        삭제
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

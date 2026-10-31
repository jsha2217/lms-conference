import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAccountNames, useAuth } from '../hooks/useAuth'
import './Auth.css'

export default function Login() {
  const { me, signIn } = useAuth()
  const names = useAccountNames()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (me) return <Navigate to="/admin" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const err = await signIn(name, password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/admin')
  }

  return (
    <main className="auth">
      <form className="auth-card glass" onSubmit={submit}>
        <h1>로그인</h1>
        <p className="auth-sub">팀 대표자와 총괄 계정만 로그인할 수 있습니다.</p>
        <label className="field">
          이름
          <select className="input" value={name} onChange={(e) => setName(e.target.value)} required>
            <option value="" disabled>
              선택하세요
            </option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          비밀번호
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !name || !password}>
          {busy ? '확인 중…' : '로그인'}
        </button>
        <p className="auth-link">
          처음이신가요? <Link to="/setup">초대코드로 비밀번호 설정</Link>
        </p>
      </form>
    </main>
  )
}

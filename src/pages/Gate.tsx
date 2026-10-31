import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import './Auth.css'

// 공통 비밀번호 입력 화면: 세션이 없으면 모든 경로에서 이 화면만 보임
export default function Gate() {
  const { enterSite } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await enterSite(code.trim())
    setBusy(false)
    if (err) {
      setError(err)
      setCode('')
    }
  }

  return (
    <main className="auth">
      <form className="auth-card glass" onSubmit={submit}>
        <h1>LMS Conference</h1>
        <p className="auth-sub">공통 비밀번호를 입력하면 입장할 수 있습니다.</p>
        <label className="field">
          공통 비밀번호
          <input
            className="input"
            type="password"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoFocus
            required
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !code.trim()}>
          {busy ? '확인 중…' : '입장'}
        </button>
      </form>
    </main>
  )
}

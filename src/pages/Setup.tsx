import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccountNames, useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function Setup() {
  const { signIn } = useAuth()
  const names = useAccountNames()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 10) return setError('비밀번호는 10자 이상이어야 합니다.')
    if (password !== confirm) return setError('비밀번호가 서로 다릅니다.')
    setBusy(true)
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke('claim-account', {
      body: { name, code: code.trim(), password },
    })
    if (fnError || data?.error) {
      let message = data?.error as string | undefined
      if (!message && fnError && 'context' in fnError) {
        message = await (fnError.context as Response).json().then((j) => j.error).catch(() => undefined)
      }
      setError(message ?? '비밀번호 설정에 실패했습니다.')
      setBusy(false)
      return
    }
    const err = await signIn(name, password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/admin')
  }

  return (
    <main className="auth">
      <form className="auth-card glass" onSubmit={submit}>
        <h1>비밀번호 설정</h1>
        <p className="auth-sub">
          전달받은 초대코드로 내 비밀번호를 설정합니다.
          <br />
          코드는 한 번만 사용할 수 있습니다.
        </p>
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
          초대코드
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="8자리 코드"
            autoComplete="off"
            style={{ letterSpacing: '0.2em' }}
            required
          />
        </label>
        <label className="field">
          새 비밀번호 (10자 이상)
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </label>
        <label className="field">
          비밀번호 확인
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !name || !code || !password}>
          {busy ? '설정 중…' : '비밀번호 설정'}
        </button>
        <p className="auth-link">
          이미 설정했나요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </main>
  )
}

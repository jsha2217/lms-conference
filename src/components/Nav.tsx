import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleLabel } from '../lib/types'
import './Nav.css'

export default function Nav() {
  const { me, signOut } = useAuth()

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="nav-logo">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 3l2.6 8.2L27 14l-8.4 2.8L16 25l-2.6-8.2L5 14l8.4-2.8z" fill="url(#logo-g)" />
            <circle cx="25" cy="6" r="1.6" fill="#fbeec4" />
            <defs>
              <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" />
                <stop offset="1" stopColor="#e6bf5c" />
              </linearGradient>
            </defs>
          </svg>
          <span>LMS Conference</span>
        </Link>

        <nav className="nav-actions">
          {me ? (
            <>
              <span className="nav-me">
                {me.name}
                <small>{me.role === 'admin' ? roleLabel(me.role) : `${me.team}팀 ${roleLabel(me.role)}`}</small>
              </span>
              <Link to="/admin" className="btn btn-gold btn-sm">
                관리
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={signOut}>
                로그아웃
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost btn-sm">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

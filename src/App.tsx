import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Nav from './components/Nav'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Admin from './pages/Admin'
import Gate from './pages/Gate'
import Home from './pages/Home'
import Login from './pages/Login'
import Setup from './pages/Setup'

// GitHub Pages는 SPA 경로 rewrite가 없어서 HashRouter 사용
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <GatedRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

// 세션(조회 계정 또는 대표자/총괄)이 없으면 공통 비밀번호 화면만 보임
function GatedRoutes() {
  const { session, ready } = useAuth()
  if (!ready) return null
  if (!session) return <Gate />

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team/:team" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

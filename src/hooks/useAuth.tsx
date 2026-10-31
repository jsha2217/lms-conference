import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { loginEmail, supabase } from '../lib/supabase'
import type { Member } from '../lib/types'

interface AuthState {
  session: Session | null
  me: Member | null
  loading: boolean
  /** 저장된 세션 확인이 끝났는지 (끝나기 전엔 공통 비번 화면을 띄우지 않음) */
  ready: boolean
  enterSite: (code: string) => Promise<string | null>
  signIn: (name: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setMe(null)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('members')
      .select('id, name, team, role, user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setMe(data as Member | null)
        setLoading(false)
      })
  }, [session?.user.id])

  // 이름 → 계정 이메일로 변환해서 로그인. 실패 시 에러 메시지 반환
  const signIn = async (name: string, password: string) => {
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('name', name)
      .in('role', ['lead', 'admin'])
      .maybeSingle()
    if (!member) return '등록되지 않은 계정입니다.'
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(member.id), password })
    if (error) return '비밀번호가 올바르지 않거나 아직 비밀번호를 설정하지 않은 계정입니다.'
    return null
  }

  // 공통 비밀번호 → 공용 조회 계정으로 로그인. 실패 시 에러 메시지 반환
  // 여러 명이 동시에 입장하면 토큰이 덮어써질 수 있어 몇 번 재시도
  const enterSite = async (code: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.functions.invoke('enter-site', { body: { code } })
      if (error || !data?.token_hash) {
        let message: string | undefined
        if (error && 'context' in error) {
          message = await (error.context as Response).json().then((j) => j.error).catch(() => undefined)
        }
        return message ?? '입장에 실패했습니다.'
      }
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' })
      if (!otpError) return null
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 400))
    }
    return '입장에 실패했습니다. 다시 시도해 주세요.'
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return <AuthContext.Provider value={{ session, me, loading, ready, enterSite, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

// 로그인/비밀번호 설정 화면의 이름 선택지
export function useAccountNames() {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    supabase
      .from('members')
      .select('name, role, team')
      .in('role', ['lead', 'admin'])
      .order('team', { nullsFirst: true })
      .order('name')
      .then(({ data }) => setNames((data ?? []).map((m) => m.name)))
  }, [])
  return names
}

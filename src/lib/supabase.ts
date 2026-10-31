import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// supabase/functions/claim-account 의 loginEmail 과 동일해야 함
export const loginEmail = (memberId: string) => `m-${memberId}@accounts.lms-conference.dev`

// 비밀번호 4~30자. Supabase Auth 최소 길이가 6자라 6자 미만은 고정 문자열을 덧붙여 저장
// supabase/functions/claim-account 의 authPassword 와 동일해야 함
export const PASSWORD_MIN = 4
export const PASSWORD_MAX = 30
export const authPassword = (password: string) => (password.length < 6 ? `${password}#lms-pad` : password)

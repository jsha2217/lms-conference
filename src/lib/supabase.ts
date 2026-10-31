import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// supabase/functions/claim-account 의 loginEmail 과 동일해야 함
export const loginEmail = (memberId: string) => `m-${memberId}@accounts.lms-conference.dev`

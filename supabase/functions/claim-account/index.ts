// 초대코드로 계정 비밀번호 설정(최초 등록/재설정 겸용)
// POST { name, code, password }
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// src/lib/supabase.ts 의 loginEmail 과 동일해야 함
const loginEmail = (memberId: string) => `m-${memberId}@accounts.lms-conference.dev`
// src/lib/supabase.ts 의 authPassword 와 동일해야 함 (Supabase Auth 최소 6자 대응)
const authPassword = (password: string) => (password.length < 6 ? `${password}#lms-pad` : password)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { name?: string; code?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: '잘못된 요청입니다.' }, 400)
  }
  const { name, code, password } = body
  if (!name || !code || !password) return json({ error: '이름, 초대코드, 비밀번호를 모두 입력해 주세요.' }, 400)
  if (password.length < 4 || password.length > 30) return json({ error: '비밀번호는 4~30자로 입력해 주세요.' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.rpc('check_invite', { p_name: name, p_code: code })
  if (error) return json({ error: '확인 중 오류가 발생했습니다.' }, 500)
  const match = (data as { member_id: string; user_id: string | null }[])[0]
  if (!match) return json({ error: '이름 또는 초대코드가 올바르지 않거나 이미 사용된 코드입니다.' }, 400)

  if (match.user_id) {
    const { error: updErr } = await admin.auth.admin.updateUserById(match.user_id, { password: authPassword(password) })
    if (updErr) return json({ error: updErr.message }, 400)
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: loginEmail(match.member_id),
      password: authPassword(password),
      email_confirm: true,
    })
    if (createErr) return json({ error: createErr.message }, 400)
    const { error: linkErr } = await admin.from('members').update({ user_id: created.user.id }).eq('id', match.member_id)
    if (linkErr) return json({ error: '계정 연결에 실패했습니다.' }, 500)
  }

  await admin.from('invites').update({ used_at: new Date().toISOString() }).eq('member_id', match.member_id)
  return json({ ok: true })
})

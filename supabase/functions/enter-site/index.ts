// 조회용 공통 비밀번호 확인 → 공용 조회 계정(viewer) 1회용 로그인 토큰 발급
// POST { code } → { token_hash }  (클라이언트가 auth.verifyOtp 로 세션 생성)
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// supabase/migrations/*_view_gate.sql 의 set_view_code 와 동일해야 함
const VIEWER_EMAIL = 'viewer@accounts.lms-conference.dev'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const clientIp = (req: Request) =>
  req.headers.get('cf-connecting-ip') ??
  req.headers.get('x-real-ip') ??
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  'unknown'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let code: unknown
  try {
    code = (await req.json()).code
  } catch {
    return json({ error: '잘못된 요청입니다.' }, 400)
  }
  if (typeof code !== 'string' || !code.trim()) return json({ error: '비밀번호를 입력해 주세요.' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: result, error } = await admin.rpc('check_view_code', { p_code: code, p_ip: clientIp(req) })
  if (error) return json({ error: '확인 중 오류가 발생했습니다.' }, 500)
  if (result === 'locked') return json({ error: '시도 횟수를 초과했습니다. 10분 후 다시 시도해 주세요.' }, 429)
  if (result !== 'ok') return json({ error: '비밀번호가 올바르지 않습니다.' }, 401)

  const generate = () => admin.auth.admin.generateLink({ type: 'magiclink', email: VIEWER_EMAIL })
  let { data: link, error: linkErr } = await generate()
  if (linkErr) {
    // 조회 계정이 아직 없으면 생성 (최초 1회)
    const { error: createErr } = await admin.auth.admin.createUser({ email: VIEWER_EMAIL, email_confirm: true })
    if (createErr) return json({ error: '입장 처리에 실패했습니다.' }, 500)
    ;({ data: link, error: linkErr } = await generate())
  }
  if (linkErr || !link?.properties?.hashed_token) return json({ error: '입장 처리에 실패했습니다.' }, 500)

  return json({ token_hash: link.properties.hashed_token })
})

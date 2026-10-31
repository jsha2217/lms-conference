-- 조회용 공통 비밀번호 + 보안 보강
-- 흐름: 공통 비번 입력 → edge function(enter-site)이 확인 → 공용 조회 계정(viewer) 로그인 토큰 발급
-- 이제 비로그인(anon)은 아무 데이터도 읽지 못함. 가입이 꺼져 있으므로 authenticated = 조회 계정 + 대표자/총괄

-- ───────────────────────── 공통 비밀번호 ─────────────────────────

create table public.site_settings (
  id             boolean primary key default true check (id),  -- 단일 행
  view_code_hash text
);
insert into public.site_settings (id) values (true);

-- 공통 비번 오입력 기록(IP별 10분 10회 제한)
create table public.gate_attempts (
  id         bigint generated always as identity primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);
create index gate_attempts_ip_idx on public.gate_attempts (ip, created_at desc);

alter table public.site_settings enable row level security;  -- 정책 없음 = service role 전용
alter table public.gate_attempts enable row level security;
revoke all on public.site_settings, public.gate_attempts from anon, authenticated;

-- SQL 에디터에서 실행: select public.set_view_code('새비번');
-- 평문은 저장하지 않음(bcrypt). 변경 시 기존 조회 세션도 모두 끊김
create function public.set_view_code(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if length(btrim(coalesce(p_code, ''))) < 4 then
    raise exception 'view code must be at least 4 characters';
  end if;
  update public.site_settings set view_code_hash = extensions.crypt(btrim(p_code), extensions.gen_salt('bf'));
  delete from auth.sessions s using auth.users u
  where s.user_id = u.id and u.email = 'viewer@accounts.lms-conference.dev';
end $$;

-- edge function(enter-site) 전용: 'ok' | 'wrong' | 'locked'
create function public.check_view_code(p_code text, p_ip text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
begin
  if (select count(*) from public.gate_attempts a
      where a.ip = p_ip and a.created_at > now() - interval '10 minutes') >= 10 then
    return 'locked';
  end if;

  select view_code_hash into v_hash from public.site_settings;
  if v_hash is not null and v_hash = extensions.crypt(btrim(coalesce(p_code, '')), v_hash) then
    return 'ok';
  end if;

  insert into public.gate_attempts (ip) values (p_ip);
  delete from public.gate_attempts where created_at < now() - interval '1 day';
  return 'wrong';
end $$;

revoke execute on function public.set_view_code(text) from public, anon, authenticated;
revoke execute on function public.check_view_code(text, text) from public, anon, authenticated;
grant execute on function public.check_view_code(text, text) to service_role;

-- ───────────────────────── 조회 권한: anon → 로그인 사용자 ─────────────────────────

drop policy "members readable by everyone" on public.members;
drop policy "passes readable by everyone" on public.passes;

create policy "members readable by signed-in" on public.members
  for select to authenticated using (true);
create policy "passes readable by signed-in" on public.passes
  for select to authenticated using (true);

revoke select on public.members, public.passes, public.member_scores from anon;

-- ───────────────────────── passes.created_at 조작 방지 ─────────────────────────
-- 통과 시각은 서버 now()로만 기록 (달성일/달성 순서 조작 차단)

revoke insert on public.passes from authenticated;
grant insert (member_id) on public.passes to authenticated;

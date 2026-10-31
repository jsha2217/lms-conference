-- LMS Conference: 팀별 LMS 단계 통과 집계
-- members: 사람(맴버/대표자/manager) / passes: 통과 1건 = 1행 / invites: 첫 비밀번호 설정용 1회 코드

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── tables ─────────────────────────

create table public.members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 30),
  team       smallint check (team in (1, 2)),
  role       text not null default 'member' check (role in ('member', 'lead', 'admin')),
  user_id    uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint members_team_required check (role = 'admin' or team is not null)
);

-- 로그인은 이름으로 하므로 계정 보유자 이름은 유일해야 함
create unique index members_account_name_key on public.members (name) where role in ('lead', 'admin');

create table public.passes (
  id           bigint generated always as identity primary key,
  member_id    uuid not null references public.members (id) on delete cascade,
  committed_by uuid references public.members (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index passes_member_id_idx on public.passes (member_id);
create index passes_created_at_idx on public.passes (created_at desc);

create table public.invites (
  member_id       uuid primary key references public.members (id) on delete cascade,
  code_hash       text not null,
  failed_attempts int not null default 0,
  used_at         timestamptz
);

-- ───────────────────────── helpers ─────────────────────────

create function public.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.members where user_id = auth.uid()
$$;

create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.members where user_id = auth.uid()
$$;

create function public.my_team() returns smallint
language sql stable security definer set search_path = '' as $$
  select team from public.members where user_id = auth.uid()
$$;

create function public.member_team(p_member uuid) returns smallint
language sql stable security definer set search_path = '' as $$
  select team from public.members where id = p_member
$$;

-- admin은 양 팀, lead는 자기 팀만
create function public.can_manage_team(p_team smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'admin' or (public.my_role() = 'lead' and public.my_team() = p_team), false)
$$;

-- 커밋한 사람은 클라이언트가 아니라 세션에서 결정
create function public.set_committed_by() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.committed_by := public.my_member_id();
  return new;
end $$;

create trigger passes_set_committed_by
before insert on public.passes
for each row execute function public.set_committed_by();

-- ───────────────────────── scores ─────────────────────────
-- 맴버: 단계당 1점, 상한 없음
-- 대표자: 단계당 1점, 7단계 이수 시 10점(+3 보너스), 이후 10점 고정

create view public.member_scores with (security_invoker = true) as
select
  m.id,
  m.name,
  m.team,
  m.role,
  count(p.id)::int as steps,
  (case
     when m.role = 'lead' and count(p.id) >= 7 then 10
     else count(p.id)
   end)::int as score,
  (array_agg(p.created_at order by p.created_at))[7] as achieved_at
from public.members m
left join public.passes p on p.member_id = m.id
where m.role in ('member', 'lead')
group by m.id;

-- ───────────────────────── RLS ─────────────────────────

alter table public.members enable row level security;
alter table public.passes  enable row level security;
alter table public.invites enable row level security;  -- 정책 없음 = service role 전용

create policy "members readable by everyone" on public.members
  for select to anon, authenticated using (true);

create policy "members insert by manager" on public.members
  for insert to authenticated
  with check (
    public.my_role() = 'admin'
    or (public.my_role() = 'lead' and team = public.my_team() and role = 'member' and user_id is null)
  );

create policy "members update by manager" on public.members
  for update to authenticated
  using (
    public.my_role() = 'admin'
    or (public.my_role() = 'lead' and team = public.my_team() and role = 'member')
  )
  with check (
    public.my_role() = 'admin'
    or (public.my_role() = 'lead' and team = public.my_team() and role = 'member' and user_id is null)
  );

create policy "members delete by manager" on public.members
  for delete to authenticated
  using (
    (public.my_role() = 'admin' and role <> 'admin')
    or (public.my_role() = 'lead' and team = public.my_team() and role = 'member')
  );

create policy "passes readable by everyone" on public.passes
  for select to anon, authenticated using (true);

create policy "passes insert by team manager" on public.passes
  for insert to authenticated
  with check (public.can_manage_team(public.member_team(member_id)));

create policy "passes delete by team manager" on public.passes
  for delete to authenticated
  using (public.can_manage_team(public.member_team(member_id)));

grant select on public.members, public.passes, public.member_scores to anon, authenticated;
grant insert, update, delete on public.members to authenticated;
grant insert, delete on public.passes to authenticated;
revoke all on public.invites from anon, authenticated;

-- ───────────────────────── invites ─────────────────────────

-- SQL 에디터에서 실행: select public.issue_invite('이름');  → 평문 코드 반환(재발급 시 기존 코드 무효)
create function public.issue_invite(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_code   text := '';
  v_chars  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes  bytea := extensions.gen_random_bytes(8);
begin
  select id into v_member from public.members where name = p_name and role in ('lead', 'admin');
  if v_member is null then
    raise exception 'account not found: %', p_name;
  end if;

  for i in 0..7 loop
    v_code := v_code || substr(v_chars, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;

  insert into public.invites (member_id, code_hash)
  values (v_member, extensions.crypt(v_code, extensions.gen_salt('bf')))
  on conflict (member_id) do update
    set code_hash = excluded.code_hash, failed_attempts = 0, used_at = null;

  return v_code;
end $$;

-- edge function(claim-account) 전용: 코드가 맞으면 계정 정보 반환, 틀리면 시도 횟수 증가(10회 잠금)
create function public.check_invite(p_name text, p_code text)
returns table (member_id uuid, user_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members;
  v_invite public.invites;
begin
  select * into v_member from public.members m where m.name = p_name and m.role in ('lead', 'admin');
  if v_member.id is null then return; end if;

  select * into v_invite from public.invites i where i.member_id = v_member.id;
  if v_invite.member_id is null or v_invite.used_at is not null or v_invite.failed_attempts >= 10 then
    return;
  end if;

  if v_invite.code_hash <> extensions.crypt(upper(btrim(p_code)), v_invite.code_hash) then
    update public.invites i set failed_attempts = i.failed_attempts + 1 where i.member_id = v_member.id;
    return;
  end if;

  member_id := v_member.id;
  user_id := v_member.user_id;
  return next;
end $$;

revoke execute on function public.issue_invite(text) from public, anon, authenticated;
revoke execute on function public.check_invite(text, text) from public, anon, authenticated;
grant execute on function public.check_invite(text, text) to service_role;

-- ───────────────────────── realtime ─────────────────────────

alter publication supabase_realtime add table public.passes, public.members;

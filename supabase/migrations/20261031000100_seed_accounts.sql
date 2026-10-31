-- 총괄 계정 (비밀번호는 초대코드로 설정)
-- 대표자 실명은 저장소에 두지 않음: 운영 DB에 직접 입력, 로컬은 supabase/seed.sql(gitignore)로 db reset 시 입력
--   insert into public.members (name, team, role) values ('이름', 1, 'lead');
insert into public.members (name, team, role) values
  ('manager', null, 'admin');

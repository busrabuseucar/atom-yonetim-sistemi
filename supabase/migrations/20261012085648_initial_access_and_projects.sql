begin;
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 150)
);
create table public.memberships (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','research','officer','viewer')),
 primary key (organization_id,user_id)
);
create index memberships_user_id_idx on public.memberships(user_id);
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 created_by uuid not null references auth.users(id),
 title text not null check (length(trim(title)) between 1 and 150),
 summary text not null check (length(trim(summary)) between 1 and 5000),
 benefit text not null check (length(trim(benefit)) between 1 and 3000),
 status text not null default 'submitted' check(status in ('submitted','revision','active')),
 feedback text not null default '' check(length(feedback)<=3000),
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index projects_org_created_idx on public.projects(organization_id,created_at desc);
create index projects_created_by_idx on public.projects(created_by);
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
-- Memberships are provisioned by the trusted administrator, never by browser clients.
revoke all on public.organizations, public.memberships, public.projects from anon, authenticated;
grant select on public.organizations,public.memberships,public.projects to authenticated;
grant insert (organization_id,created_by,title,summary,benefit) on public.projects to authenticated;
grant update (status,feedback) on public.projects to authenticated;
create policy memberships_read_self on public.memberships for select to authenticated
 using(user_id=(select auth.uid()));
create policy organizations_read_member on public.organizations for select to authenticated
 using(exists(select 1 from public.memberships m where m.organization_id=id and m.user_id=(select auth.uid())));
create policy projects_read_member on public.projects for select to authenticated
 using(exists(select 1 from public.memberships m where m.organization_id=projects.organization_id and m.user_id=(select auth.uid())));
create policy projects_create_officer on public.projects for insert to authenticated
 with check(created_by=(select auth.uid()) and status='submitted' and feedback='' and version=1
 and exists(select 1 from public.memberships m where m.organization_id=projects.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','officer')));
create policy projects_review_authorized on public.projects for update to authenticated
 using(exists(select 1 from public.memberships m where m.organization_id=projects.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','research')))
 with check(exists(select 1 from public.memberships m where m.organization_id=projects.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','research')));
-- SECURITY INVOKER: no privilege elevation. Column grants prevent ownership/organization tampering.
create function public.validate_project_review() returns trigger language plpgsql
 security invoker set search_path='' as $$
begin
 if old.status <> 'submitted' or new.status not in ('revision','active') or length(trim(new.feedback))=0 then
  raise exception 'Invalid review transition';
 end if;
 new.updated_at=now();
 new.version=old.version+1;
 return new;
end;
$$;
revoke all on function public.validate_project_review() from public,anon,authenticated;
create trigger validate_project_review before update on public.projects
 for each row execute function public.validate_project_review();
commit;

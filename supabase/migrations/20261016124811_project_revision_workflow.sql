begin;
grant update (title,summary,benefit) on public.projects to authenticated;
create policy projects_resubmit_authorized on public.projects for update to authenticated
 using(status='revision' and exists(
  select 1 from public.memberships m where m.organization_id=projects.organization_id
  and m.user_id=(select auth.uid()) and (m.role='admin' or (m.role='officer' and projects.created_by=(select auth.uid())))
 ))
 with check(status='submitted' and exists(
  select 1 from public.memberships m where m.organization_id=projects.organization_id
  and m.user_id=(select auth.uid()) and (m.role='admin' or (m.role='officer' and projects.created_by=(select auth.uid())))
 ));

-- Column grants are shared by authenticated users. The trigger enforces which
-- columns each transition may change, even when a client bypasses the UI.
create or replace function public.validate_project_review() returns trigger language plpgsql
 security invoker set search_path='' as $$
declare actor_role text;
begin
 select role into actor_role from public.memberships
 where organization_id=old.organization_id and user_id=(select auth.uid());
 if old.status='submitted' and new.status in ('revision','active')
    and actor_role in ('admin','research') then
  if length(trim(new.feedback))=0 then raise exception 'Review reason required'; end if;
  if row(new.title,new.summary,new.benefit) is distinct from row(old.title,old.summary,old.benefit) then
   raise exception 'Review cannot edit proposal content';
  end if;
 elsif old.status='revision' and new.status='submitted'
    and (actor_role='admin' or (actor_role='officer' and old.created_by=(select auth.uid()))) then
  if new.feedback is distinct from old.feedback then raise exception 'Review feedback must be preserved'; end if;
  if row(new.title,new.summary,new.benefit) is not distinct from row(old.title,old.summary,old.benefit) then
   raise exception 'Revision must change proposal content';
  end if;
 else
  raise exception 'Invalid project transition or permission';
 end if;
 if row(new.id,new.organization_id,new.created_by,new.created_at,new.version) is distinct from
    row(old.id,old.organization_id,old.created_by,old.created_at,old.version) then
  raise exception 'Project identity and version are server managed';
 end if;
 new.updated_at=now();
 new.version=old.version+1;
 return new;
end;
$$;
revoke all on function public.validate_project_review() from public,anon,authenticated;
commit;

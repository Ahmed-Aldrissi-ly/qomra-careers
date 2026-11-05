create schema if not exists qomra_recruitment_private;
revoke all on schema qomra_recruitment_private from public,anon,authenticated;
grant usage on schema qomra_recruitment_private to service_role;

create table public.qomra_job_reviewers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 require_mfa boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.qomra_job_reviewers enable row level security;
revoke all on public.qomra_job_reviewers from public,anon,authenticated;
grant select on public.qomra_job_reviewers to authenticated;
grant all on public.qomra_job_reviewers to service_role;
create policy reviewers_read_own on public.qomra_job_reviewers for select to authenticated using(user_id=(select auth.uid()));
insert into public.qomra_job_reviewers(user_id,require_mfa)
 select u.id,exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified')
 from auth.users u where lower(u.email)='qomra.ca@gmail.com' and u.email_confirmed_at is not null;

create table public.qomra_job_applications (
 id uuid primary key,
 name text not null check(char_length(name) between 2 and 120),
 email text not null check(char_length(email) between 3 and 254),
 phone text not null check(char_length(phone) between 7 and 30),
 role text not null check(role in('Videographer','Photographer','Photographer / Videographer','Social Media Manager','Content Creator','Creative Director','Graphic Designer','Other')),
 other_role text not null default '' check(char_length(other_role)<=120),
 portfolio text not null default '' check(char_length(portfolio)<=2000),
 status text not null default 'New' check(status in('New','Reviewing','Shortlisted','Contacted','Archived')),
 notes text not null default '' check(char_length(notes)<=5000),
 created_at timestamptz not null default now(),
 check(role<>'Other' or char_length(other_role)>=2)
);
create index qomra_jobs_created_idx on public.qomra_job_applications(created_at desc,id);
create index qomra_jobs_filter_idx on public.qomra_job_applications(role,status,created_at desc);
alter table public.qomra_job_applications enable row level security;
revoke all on public.qomra_job_applications from public,anon,authenticated;
grant select,update(status,notes) on public.qomra_job_applications to authenticated;
grant all on public.qomra_job_applications to service_role;
create policy jobs_reviewer_read on public.qomra_job_applications for select to authenticated
 using(exists(select 1 from public.qomra_job_reviewers r where r.user_id=(select auth.uid()) and (not r.require_mfa or (select auth.jwt()->>'aal')='aal2')));
create policy jobs_reviewer_update on public.qomra_job_applications for update to authenticated
 using(exists(select 1 from public.qomra_job_reviewers r where r.user_id=(select auth.uid()) and (not r.require_mfa or (select auth.jwt()->>'aal')='aal2')))
 with check(exists(select 1 from public.qomra_job_reviewers r where r.user_id=(select auth.uid()) and (not r.require_mfa or (select auth.jwt()->>'aal')='aal2')));

create table public.qomra_job_files (
 id uuid primary key,
 application_id uuid not null references public.qomra_job_applications(id) on delete cascade,
 kind text not null check(kind in('resume','work')),
 object_key text not null unique,
 name text not null check(char_length(name) between 1 and 200),
 size bigint not null check(size>0 and size<=10485760),
 check(kind<>'resume' or size<=5242880)
);
create index qomra_job_files_application_idx on public.qomra_job_files(application_id);
alter table public.qomra_job_files enable row level security;
revoke all on public.qomra_job_files from public,anon,authenticated;
grant select on public.qomra_job_files to authenticated;
grant all on public.qomra_job_files to service_role;
create policy job_files_reviewer_read on public.qomra_job_files for select to authenticated
 using(exists(select 1 from public.qomra_job_reviewers r where r.user_id=(select auth.uid()) and (not r.require_mfa or (select auth.jwt()->>'aal')='aal2')));

create policy qomra_job_private_download on storage.objects for select to authenticated
 using(bucket_id='qomra-job-files' and exists(select 1 from public.qomra_job_reviewers r where r.user_id=(select auth.uid()) and (not r.require_mfa or (select auth.jwt()->>'aal')='aal2')));

create table qomra_recruitment_private.rate_limits (
 key text primary key, hits integer not null default 1, expires_at timestamptz not null
);
alter table qomra_recruitment_private.rate_limits enable row level security;
grant all on qomra_recruitment_private.rate_limits to service_role;
create policy service_rate_limit_access on qomra_recruitment_private.rate_limits for all to service_role using(true) with check(true);
create function public.qomra_job_attempt(bucket_key text) returns integer language plpgsql security invoker set search_path='' as $$
 declare result integer;
 begin
 delete from qomra_recruitment_private.rate_limits where expires_at<now();
 insert into qomra_recruitment_private.rate_limits(key,hits,expires_at) values(bucket_key,1,now()+interval '30 minutes')
 on conflict(key) do update set hits=qomra_recruitment_private.rate_limits.hits+1 returning hits into result;
 return result;
 end;
$$;
revoke all on function public.qomra_job_attempt(text) from public,anon,authenticated;
grant execute on function public.qomra_job_attempt(text) to service_role;

create function public.qomra_job_submit(application jsonb,attachments jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
 declare app_id uuid := (application->>'id')::uuid;
 begin
 if jsonb_array_length(attachments)>4 then raise exception 'Too many attachments';end if;
 insert into public.qomra_job_applications(id,name,email,phone,role,other_role,portfolio)
 values(app_id,application->>'name',application->>'email',application->>'phone',application->>'role',coalesce(application->>'other_role',''),coalesce(application->>'portfolio',''));
 insert into public.qomra_job_files(id,application_id,kind,object_key,name,size)
 select (f->>'id')::uuid,app_id,f->>'kind',f->>'object_key',f->>'name',(f->>'size')::bigint from jsonb_array_elements(attachments) f;
 return app_id;
 end;
$$;
revoke all on function public.qomra_job_submit(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.qomra_job_submit(jsonb,jsonb) to service_role;

create function public.qomra_job_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'summary',coalesce((select jsonb_agg(s) from(select status,count(*)::integer as count from public.qomra_job_applications group by status)s),'[]'::jsonb),
  'byRole',coalesce((select jsonb_agg(r) from(select role,count(*)::integer as count from public.qomra_job_applications group by role order by count(*) desc)r),'[]'::jsonb)
 );
$$;
revoke all on function public.qomra_job_summary() from public,anon;
grant execute on function public.qomra_job_summary() to authenticated,service_role;

-- Keep retired occupations valid for historical applications; new submissions
-- are restricted to the active roles by the shared Edge Function validation.
begin;
alter table public.qomra_job_applications
  drop constraint qomra_job_applications_role_check;
alter table public.qomra_job_applications
  add constraint qomra_job_applications_role_check check (role in (
    'Videographer', 'Photographer', 'Photographer / Videographer',
    'Social Media Manager', 'Content Creator', 'On-camera Presenter',
    'Creative Director', 'Graphic Designer', 'Other'
  ));
commit;

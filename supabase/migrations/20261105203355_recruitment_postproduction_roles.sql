-- Preserve historical occupations while accepting the new postproduction roles.
begin;
alter table public.qomra_job_applications
  drop constraint qomra_job_applications_role_check;
alter table public.qomra_job_applications
  add constraint qomra_job_applications_role_check check (role in (
    'Videographer', 'Photographer', 'Photographer / Videographer',
    'Video Editor', 'Motion Graphics Designer',
    'Social Media Manager', 'Content Creator', 'On-camera Presenter',
    'Creative Director', 'Graphic Designer', 'Other'
  ));
commit;

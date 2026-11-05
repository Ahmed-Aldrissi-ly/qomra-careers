# Qomra recruitment

English, mobile-first application form and a separate private recruitment dashboard.

## Hosting

GitHub Pages automatically builds and deploys `main` after validation:
- Application form: https://qomra-ca.github.io/qomra-careers/
- Private dashboard sign-in: https://qomra-ca.github.io/qomra-careers/team/

Only the website source and static build are public. Applications, notes and uploads remain in Supabase. The initial Sites address remains available and uses the same backend.

## Pages

- `/` — public application form, no applicant sign-in
- `/team/` — company account sign-in and recruitment dashboard
- `/privacy/` — applicant privacy information

The applicant page has no dashboard link. The dashboard includes response search, occupation/status filters, summary counts, private notes, review statuses, protected file downloads, and CSV export.

## Run locally

Use Node 24 (or Node >=22.13):

```sh
npm ci
npm run dev
npm test
npm run build
```

The development server uses port 5181. Production output is `dist/`, suitable for any static HTTPS host. Vite builds separate application, dashboard and privacy entry points. Set `PUBLIC_BASE_PATH=/repository-name/` when building for a GitHub project Pages URL.

## Backend and access

Supabase project: `lqupogaiwncpfbrpowrq`. Recruitment uses its own `qomra_job_*` tables and the private `qomra-job-files` storage bucket, separate from the existing business system.

`src/config.ts` contains only the public project URL and publishable key. These are designed to be shipped to browsers. Never put a service-role or secret key here.

The public form posts to the `qomra-job-apply` Edge Function. The function validates fields and file signatures, limits request/file sizes, rate-limits submissions, stores files privately, and commits the application plus attachment metadata transactionally. Retry IDs prevent duplicate applications.

Only the confirmed existing Supabase Auth account `qomra.ca@gmail.com` was added to `qomra_job_reviewers`. Sign in with that Qomra account's existing password, not the Gmail password. Google OAuth is not configured. There is no public recruitment signup. Authentication and row-level policies protect applications, review notes, metadata and storage downloads even if someone knows the dashboard URL or public key.

Reviewers can update status and private notes, not applicant contact details. The SQL allowlist controls access; hiding the dashboard link is not the security boundary. MFA is supported when enabled for the company account; update the reviewer's `require_mfa` flag when requiring assurance level 2 at the database layer.

## Backend deployment

The migration is in `supabase/migrations/`; it has already been applied to the above project. Do not reapply manually. On a fresh project, establish the company Auth account before applying it, or add the confirmed user to the reviewer allowlist afterwards.

```sh
supabase link --project-ref lqupogaiwncpfbrpowrq
supabase db push
supabase functions deploy qomra-job-apply --no-verify-jwt
```

The function checks the project publishable API key itself. The endpoint intentionally accepts applicants without accounts and exposes no reading API. It reads service credentials from Supabase's server environment. Keep its CORS origin allowlist synchronized if changing domains. No secret credentials belong in GitHub.

## Validation

`npm test` covers required fields, custom occupations, optional attachments, link validation, file types/sizes, and CSV formula escaping. `npm run build` performs strict TypeScript checking and builds all pages.

`tests/live-backend.mjs` is an explicit hosted integration test, not part of CI. It creates clearly marked synthetic applications and file fixtures; run only when authorized, record their IDs, and remove the generated records and objects using an administrator connection afterwards. Production verification also checked RLS with a non-reviewer and the authorized reviewer, private storage access, and a browser submission without attachments.

## Operations

The owner has elected to publish this website source. Applicant data lives in Supabase, never in this repository or the static build. Back up database records and storage objects together. Delete attachments through the Storage API before removing an application record. CSV exports contain personal information and should remain within the hiring team.

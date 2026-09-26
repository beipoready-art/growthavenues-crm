# Be IPO Ready CRM

CRM for [Be IPO Ready](https://beipoready.com): IPO advisory and growth capital for Indian companies
(Fund Raising, Pre-IPO Advisory, SME IPO Advisory, Main Board IPOs, Valuation & Corporate Restructuring).

Stack: Next.js 15 (App Router) · Tailwind CSS · Prisma 6 · PostgreSQL (local or Supabase) · NextAuth · Recharts.

## Getting started

```bash
cp .env.example .env            # set DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET (see below)
npm install
npx prisma migrate deploy
npm run db:seed                 # demo data: enquiries, client companies, mandates, IPO issues…
npm run dev                     # http://localhost:3000
```

### Demo accounts (password `Password@123`)

| Role                 | Email                       |
| -------------------- | --------------------------- |
| Admin                | admin@beipoready.com        |
| Compliance Officer   | compliance@beipoready.com   |
| Relationship Manager | rohan@beipoready.com        |
| Relationship Manager | priya@beipoready.com        |
| Viewer               | viewer@beipoready.com       |
| Viewer (inactive)    | neha@beipoready.com         |

`npm run db:seed` wipes the database and reloads the demo data.

## What's in it

- **Leads = company enquiries:** company, contact person, sector, city, service of interest, revenue, source (website, IPO readiness call, IPO-ready check, referral, event…), and the website readiness-check score and answers. Filters, activity history, interaction log, tasks, meetings and emails.
- **Clients = companies:** CIN, company PAN, GSTIN (validated), entity type, sector, incorporation year, financials (revenue, EBITDA, PAT, net worth), multiple contacts, and an indicative SME vs main-board eligibility screen.
- **Onboarding KYC:** company documents (COI, PAN, GST, MOA/AOA, board resolution, promoter KYC). Workflow Pending → Submitted → Under Review → Verified/Rejected; only Compliance/Admin can review, and every step is recorded.
- **Mandates:** one engagement per service, each with its own stage pipeline (e.g. SME IPO: Proposal → Mandate signed → Due diligence → Restructuring → DRHP drafting → DRHP filed → Observations → Approval → RHP → Roadshow → Issue open → Listed). Also covers on hold, dropped and resume, stage history, the fee estimate (retainer + success fee), lead advisor, target date and the linked IPO issue. Board and list views.
- **Documents:** versioned vault (engagement letter, NDA, financials, DRHP/RHP drafts, valuation report, pitch deck…), PDF/Word/Excel/PowerPoint/images up to 25 MB, filed per client and optionally per mandate.
- **Meetings:** schedule from a lead or client. **Google Meet** and **Microsoft Teams** links and calendar invites are created automatically when the user has connected their account; Zoom, phone and in-person are also supported. Completing a meeting logs its outcome to the permanent interaction log.
- **Email conversations:** users connect Gmail or Outlook under **My account**. Emails exchanged with a lead or client contact (or the client's company domain) are captured on that company's timeline, and users can send and reply from the CRM. Personal mail is never stored.
- **Interaction log:** permanent (no deletes); only Admins can edit or remove an entry, with a reason, and the history is kept.
- **Website lead capture:** `POST /api/public/leads` for the beipoready.com forms (see Settings → Website integration).
- **Dashboards & reports:** pipeline by stage and fees, RM performance and leaderboard, lead-source effectiveness, CSV exports.
- **Tasks, notifications, settings:** follow-ups with due-date reminders, notification centre, company profile, reassigning an RM's book.

## Roles

The permission matrix is in [`src/lib/rbac.ts`](src/lib/rbac.ts). It's enforced in middleware, pages and every API route; the user is re-read from the DB on each request.
RMs only see their own enquiries and clients (plus mandates they lead); other RMs' records return 404.
Compliance reviews KYC and can view everything but cannot edit companies or mandates. Viewers are read-only.

## Configuration

### Database: Supabase

1. In Supabase, open your project → **Connect**.
2. Set `DATABASE_URL` to the **Transaction pooler** URI (port 6543) and add `?pgbouncer=true`.
3. Set `DIRECT_URL` to the **Session pooler** (or direct) URI (port 5432).
4. Run `npx prisma migrate deploy`, then optionally `npm run db:seed`.

The CRM itself never needs a Supabase *access token* (`sbp_…`), only these connection strings.

### File storage

- `STORAGE_DRIVER=local` (default): files are stored in `UPLOAD_DIR`. Back that folder up.
- `STORAGE_DRIVER=supabase`: a private Supabase Storage bucket. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only) and `SUPABASE_BUCKET`, and create the bucket as **private**. Files are only served through the CRM's permission-checked download routes. Use this on serverless hosts.

### Google (Gmail + Calendar/Meet)

1. In Google Cloud Console, create a project and enable the **Gmail API** and **Google Calendar API**.
2. Set up the OAuth consent screen. If you use Google Workspace, choose **Internal**: no Google verification is needed. `gmail.readonly` is a *restricted* scope, and external apps need Google's security review.
3. Create OAuth credentials of type *Web application*, with redirect URI `https://<your-crm>/api/integrations/google/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Microsoft (Outlook + Teams)

1. In Entra ID (Azure), open **App registrations → New registration**, with redirect URI `https://<your-crm>/api/integrations/microsoft/callback`.
2. Add these delegated permissions: `offline_access`, `User.Read`, `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite`.
3. Create a client secret.
4. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID` (your tenant ID, or `common`).

OAuth tokens are encrypted at rest (AES-256-GCM, key from `TOKEN_ENCRYPTION_KEY` or `NEXTAUTH_SECRET`).

### Website forms

Set `WEBSITE_API_KEY` (and optionally `WEBSITE_ALLOWED_ORIGINS`). **Settings → Website integration** shows the endpoint and a copy-paste example.
Each submission creates an enquiry assigned to the RM with the fewest open enquiries. Repeat submissions from the same email or phone are merged.

### Scheduled jobs

Call these with `Authorization: Bearer $CRON_SECRET`:
- `POST /api/cron/email-sync`: every 10–15 minutes, fetches new emails for all connected mailboxes.
- `POST /api/cron/notifications`: hourly; task-due and mandate-target reminders. These are also generated whenever a user loads a page.

### Timezone

"Today", date filters, report buckets and displayed times use `NEXT_PUBLIC_APP_TIMEZONE` (default `Asia/Kolkata`).

## Tests

59 Playwright end-to-end tests cover every module, the role restrictions, and the Google/Microsoft flows. The flows run against a local mock of their APIs (`e2e/mocks/provider-mock.mjs`), which Playwright starts automatically.

```bash
npm run db:seed
npm run build && npm run start:e2e &   # production build wired to the provider mock
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Project layout

```
prisma/schema.prisma     data model (header explains the domain)
prisma/migrations/       SQL migrations (incl. CHECK constraints, no-delete triggers)
prisma/seed.ts           demo data
src/app/(app)/           pages: dashboard, leads, clients, mandates, kyc, ipos, meetings,
                         tasks, performance, reports, notifications, account, users, settings
src/app/api/             API routes (public/leads, integrations/*, cron/* are the external entry points)
src/lib/                 domain logic: rbac, mandates, eligibility, meetings, email-sync,
                         integrations/ (OAuth, calendar, mail), storage, tz, csv
src/components/          UI: tables, cards, timelines, forms, charts
e2e/                     Playwright specs + provider mock
```

> Note for new migrations: name them with a timestamp after `20260927100000` so they sort after the existing ones.

# GrowthAvenues CRM

CRM for GrowthAvenues (stock broking & IPO advisory).
Stack: Next.js 15 (App Router) · Tailwind CSS · Prisma 6 · PostgreSQL · NextAuth (email/password) · Recharts.

## Getting started

```bash
cp .env.example .env            # set DATABASE_URL, NEXTAUTH_SECRET (and CRON_SECRET for scheduled jobs)
npm install
npx prisma migrate deploy       # or: npm run db:migrate (dev)
npm run db:seed                 # sample users, leads, clients, IPOs, documents, tasks…
npm run dev                     # http://localhost:3000
```

### Seed accounts (password `Password@123`)

| Role                 | Email                         |
| -------------------- | ----------------------------- |
| Admin                | admin@growthavenues.in        |
| Compliance Officer   | compliance@growthavenues.in   |
| Relationship Manager | rohan@growthavenues.in        |
| Relationship Manager | priya@growthavenues.in        |
| Viewer               | viewer@growthavenues.in       |
| Viewer (inactive)    | neha@growthavenues.in         |

`npm run db:seed` resets all data, so re-run it any time to get back to a clean demo state.

## Features

**Phase 1**
- **Auth & roles:** login, self-signup (the first account becomes Admin; later signups wait for activation), Admin user management.
- **Leads:** table with search and filters (status, source, RM, date range), create/edit, activity history.
- **Clients:** convert a lead into a linked client (the lead and its history are kept); clients table with KYC/type/RM/date filters.
- **KYC:** PAN / Aadhaar / bank proof / photo uploads; workflow Pending → Submitted → Under Review → Verified/Rejected; only Compliance/Admin can review; every change is logged with user and time; KYC queue for compliance.
- **Dashboard:** role-aware (firm-wide vs. RM's own) totals, leads by source and by RM, KYC breakdown.

**Phase 2**
- **IPO master list:** Admin adds/edits IPOs (price band, lot size, dates, status); filter by status.
- **IPO applications:** log from the client profile (amount defaults to lots × lot size × upper band; requires verified KYC); status Applied / Allotted / Partially Allotted / Rejected / Refunded. The IPO page shows all applicants and a follow-up list; the dashboard shows a subscription summary.
- **Documents:** Contract Note, Risk Disclosure, Application Form, Other (plus KYC). Every upload is versioned and nothing is overwritten.
- **Interaction log:** Call / Email / Meeting / WhatsApp / Note timeline on leads and clients, with a type filter. A client's timeline includes its lead-stage entries. It is permanent: only Admin can edit or remove an entry, with a reason, and the original text is kept. Database triggers block deletes.

**Phase 3**
- **RM performance:** leads assigned, converted, conversion rate, clients, IPO applications and value, for this week / month / quarter / a custom range. Admin gets a leaderboard.
- **Reports:** CSV exports (clients + KYC, IPO subscription summary, RM performance, lead sources), lead source effectiveness, and 6-month pipeline charts.
- **Tasks:** follow-ups on leads/clients with due date and priority; My tasks (overdue / today / upcoming); sidebar badge for due items.
- **Notifications:** KYC changes, new or reassigned leads/clients, task assigned, task due/overdue, and IPOs closing soon for interested clients who haven't applied. Bell dropdown plus a Notifications page (read/unread).
- **Admin & settings:** reassign an RM's whole book (leads, clients, open tasks) to another RM; company profile (firm name, logo, contact, SEBI no.) shown in the header, sidebar and login page.

## Roles & access

The permission matrix lives in [`src/lib/rbac.ts`](src/lib/rbac.ts) and is enforced at three layers:

1. **Middleware** (`src/middleware.ts`): unauthenticated users are redirected to `/login`; admin-only routes are blocked by role.
2. **Pages**: `requirePageUser(permission)`.
3. **API routes**: `requireApiUser(permission)`. The user is reloaded from the DB on every request, so role changes and deactivations apply immediately.

RMs only see records assigned to them (`ownedScope()` / `ownsRecord()`). Other RMs' records return 404.

| | Admin | Compliance | RM | Viewer |
|---|---|---|---|---|
| Leads / clients | all, edit, assign | view all | own, edit | view all |
| KYC upload & submit | ✓ | – | own | – |
| KYC review (verify/reject) | ✓ | ✓ | – | – |
| IPO master | edit | view | view | view |
| IPO applications | ✓ | view | own | view |
| Documents upload | ✓ | – | own | – |
| Interactions | log, edit/remove* | log | log (own) | view |
| Tasks | ✓, assign others | own | own | – |
| RM performance | all + leaderboard | all | self | – |
| Reports / CSV | all | all | own data | all (no RM perf.) |
| Users, reassign, settings | ✓ | – | – | – |

\* with a mandatory reason; history kept.

## Operations notes

- **File storage:** uploads go to `UPLOAD_DIR` (default `./uploads`) through the `StorageDriver` interface in `src/lib/storage.ts`. Back this directory up together with the database. To move to S3/GCS, implement the driver; the stored keys stay valid. Files are served only through authorised API routes.
- **Timezone:** "today", date filters, report buckets and displayed times use `NEXT_PUBLIC_APP_TIMEZONE` (default `Asia/Kolkata`), regardless of the server's timezone.
- **Reminders:** task-due and IPO-closing notifications are generated when a user loads a page. To also notify users who aren't signed in, call `POST /api/cron/notifications` with `Authorization: Bearer $CRON_SECRET` on a schedule (e.g. hourly).
- **Audit:** `AuditLog` records create/update/assign/convert/upload events; `KycStatusChange` is the KYC trail; `InteractionRevision` keeps edited interaction text.

## Tests

End-to-end tests (Playwright, 48 tests) cover every module, including role restrictions. Run them against a freshly seeded database. A production server is recommended, because dev mode compiles routes on first hit:

```bash
npm run db:seed
npm run build && npm start &          # or npm run dev
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Project layout

```
prisma/schema.prisma     data model (see header comment for extension notes)
prisma/migrations/       SQL migrations (incl. CHECK constraints and no-delete triggers)
prisma/seed.ts           demo data
src/app/(auth)/          login, signup
src/app/(app)/           authenticated pages (dashboard, leads, clients, kyc, ipos,
                         tasks, performance, reports, notifications, users, settings)
src/app/api/             API route handlers
src/components/          UI primitives (ui/), charts, tables, timelines, forms
src/lib/                 prisma, auth, rbac, session guards, domain helpers, tz, csv
e2e/                     Playwright specs
```

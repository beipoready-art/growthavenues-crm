# GrowthAvenues CRM

CRM for GrowthAvenues (stock broking & IPO advisory).
Stack: Next.js 15 (App Router) · Tailwind CSS · Prisma 6 · PostgreSQL · NextAuth (email/password).

## Getting started

```bash
cp .env.example .env            # then set DATABASE_URL and NEXTAUTH_SECRET
npm install
npx prisma migrate deploy       # or: npm run db:migrate (dev)
npm run db:seed                 # sample users, leads, clients
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

## Roles & access

The permission matrix lives in [`src/lib/rbac.ts`](src/lib/rbac.ts). It is checked at three layers:

1. **Middleware** (`src/middleware.ts`): redirects unauthenticated users to `/login` and blocks admin-only routes by role.
2. **Pages**: `requirePageUser(permission)` in `src/lib/session.ts`.
3. **API routes**: `requireApiUser(permission)`. The user is reloaded from the DB on every request, so role changes and deactivations take effect immediately.

RMs only see the records assigned to them (`ownedScope()` / `ownsRecord()`).

**Signup:** the first account ever created becomes an active Admin. Later self-signups are created as
*inactive Viewers*, and an Admin activates them and assigns a role on **Users**. Admins can also create users directly.

## Project layout

```
prisma/schema.prisma     data model (see header comment for extension notes)
prisma/seed.ts           sample data
src/app/(auth)/          login, signup
src/app/(app)/           authenticated app shell (sidebar) and pages
src/app/api/             API route handlers
src/components/          UI primitives (ui/), layout, sidebar
src/lib/                 prisma, auth, rbac, session guards, audit, labels
```

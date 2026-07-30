## Summary

<!-- Why this change exists and what it does (1–3 bullets). -->

-

## Test plan

- [ ] CI-relevant locally: lint / typecheck as needed; `npm test` if logic, permissions, or fragile utils changed
- [ ] Build succeeds for changes that affect app runtime (`npm run build` when relevant)
- [ ] Smoke-tested affected user flows (pages/API CRUD)

## Schema / migration

- [ ] N/A — no Prisma/schema changes
- [ ] Migration included; rollback / risk noted
- [ ] Production deploy path: backup before `prisma migrate deploy` (see `docs/ops/BACKUP.md`)

## Security

- [ ] N/A — no auth, API, secrets, upload, or cron changes
- [ ] Correct auth model (session / `withAuth` vs `CRON_SECRET`)
- [ ] RBAC / branch-company scope preserved
- [ ] No new secrets in client bundle (`NEXT_PUBLIC_*`); `.env.example` updated if needed

## Docs

- [ ] N/A
- [ ] Updated relevant docs under `docs/` (or module README)

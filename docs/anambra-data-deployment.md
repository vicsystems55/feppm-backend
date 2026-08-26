# Anambra CCE Data Deployment

## Scope

This deployment imports the approved three-sheet Anambra CCE workbook into a separate `Anambra State Ministry of Health` organization. It creates the Nigeria → South East Zone → Anambra → LGA → Ward hierarchy, facilities, facility contacts, equipment, and source-audit metadata.

Officer-in-charge records are imported only as facility contacts. The deployment does not create login accounts.

## Data-quality policy

- Equipment-only continuation rows are attached to the preceding facility.
- HFS facilities with missing wards are assigned to an explicit `Unspecified Ward` under the correct LGA.
- Invalid coordinates are stored as null; their original values remain in source-audit metadata and the reconciliation report.
- Cross-sheet facility duplicates are merged using HFS → LGA → State precedence.
- Repeated equipment within one facility is merged when a source identifier matches.
- A repeated equipment identifier across different facilities is retained on both records and reported for human review.
- The importer accepts the approved source workbook hash only. A changed workbook requires a fresh preview and explicit `--allow-source-change` approval.

## Commands

Run from `nodejs_backend`:

```bash
npm ci
npm run import:anambra:preview
npm run import:anambra:reconcile
npm run prisma:deploy
npm run import:anambra
npm run import:anambra -- --apply
npm run import:anambra:verify
```

The first `import:anambra` invocation is a database-aware preview. It must report expected create/update counts before `--apply` is used.

## Supabase production sequence

1. Take or confirm a Supabase database backup.
2. Configure `DATABASE_URL` with the Supabase pooled application URL and `DIRECT_URL` with the direct migration URL.
3. Run `npm run prisma:deploy` to apply the checked-in migration.
4. Run `npm run import:anambra` and review the zero-write database preview.
5. Run `npm run import:anambra -- --apply` once approved.
6. Run `npm run import:anambra:verify`; deployment is complete only when `passed` is `true`.
7. Publish the daily, weekly, and monthly cold-chain checklist templates through Super Admin when operational rollout is approved. Publishing is intentionally separate from importing equipment.

The importer is idempotent. A rerun updates the same deterministic facility and equipment records and does not create duplicates.

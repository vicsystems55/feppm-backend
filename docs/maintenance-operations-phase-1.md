# Maintenance Operations — Phase 1

Phase 1 establishes the foundation for FEPPM's maintenance unit. It connects issues reported by facilities to a controlled technical triage and work-order process without creating a separate product.

## Delivered capabilities

- A role-specific Maintenance Operations mission-control dashboard
- A scoped maintenance request queue sourced from the existing issue/ticket system
- Technical triage with decision, assessment, recommended action, and safety/vaccine risk flags
- Conversion of a triaged request into a numbered FEPPM work order
- Internal technician and vendor-contract assignment paths
- Technician profiles with worker type, base location, experience, availability, and technical skills
- Vendor directory and contracts restricted to approved facilities and equipment types
- Portable PostgreSQL outbox triggers for triage and work-order events
- Role-aware navigation and dashboard experiences in the Vue application

## Roles and scope

| Role | Intended scope |
| --- | --- |
| National Maintenance Manager | Organization-wide maintenance oversight |
| State Maintenance Manager | Assigned state and its descendants |
| Maintenance Scheduler | Assigned state and its descendants |
| Technician | Work and requests assigned to that technician profile |
| Vendor Admin | Work covered by the user's vendor contracts |
| Vendor Technician | Work assigned through the user's vendor contracts |

Super Admin retains complete access. User accounts are created through Accounts & Access, while technician profiles are completed in Maintenance Operations.

## Workflow

1. A facility user reports an issue through the existing ticketing module.
2. The request appears in the authorized maintenance team's request queue.
3. An authorized manager or scheduler records technical triage.
4. The request is converted to a work order and assigned internally or under an eligible vendor contract.
5. PostgreSQL writes a durable event to `OutboxEvent` whenever triage or a work order changes. A later phase can publish those events to notifications, realtime clients, email, or integrations.

## API surface

All endpoints are under `/api/v1/maintenance-operations` and require authentication plus `maintenance_operations.view`.

- `GET /dashboard`
- `GET /requests` and `GET /requests/:ticketId`
- `PUT /requests/:ticketId/triage`
- `POST /requests/:ticketId/work-orders`
- `GET /work-orders`
- `GET /technicians` and `POST /technicians`
- `POST /vendors`
- `GET /vendor-contracts`, `POST /vendor-contracts`, and `PUT /vendor-contracts/:id`
- `GET /skills` and `GET /options`

## Environment rollout

The migration uses standard PostgreSQL and runs both locally and on Supabase. It does not depend on Supabase-only trigger functions.

Local or production deployment:

```sh
npm run prisma:deploy
npm run seed:access-control
```

Optional validation against a non-production database:

```sh
npm run maintenance:verify-outbox
```

The outbox verification performs its checks inside a rollback-only transaction and leaves no test records.

## Deferred to Phase 2

- Work-order approval and state-transition actions
- Scheduling, dispatch, reassignment, and technician availability automation
- Field visit evidence, parts usage, costs, completion, and verification
- Technician mobile application and offline synchronization
- Outbox publisher for realtime notifications and external integrations
- SLA/escalation automation and performance reporting

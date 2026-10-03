# FEPPM work-order lifecycle

FEPPM uses explicit work-order states. **Active** is a dashboard grouping, not a work-order status.

1. `DRAFT` — created from a triaged support request.
2. `PENDING_APPROVAL` — submitted for management approval.
3. `APPROVED` — authorized, but not yet assigned.
4. `ASSIGNED` — scheduled and assigned; now visible and actionable to the technician.
5. `ACCEPTED` — the technician has acknowledged the assignment.
6. `IN_PROGRESS` — the technician has started field work.
7. `AWAITING_PARTS` — optional pause created by a submitted tool or spare-parts request.
8. `AWAITING_VERIFICATION` — the technician submitted the field report and evidence.
9. `COMPLETED` — a manager verified the work and the linked issue was resolved.

`CANCELLED` is a terminal exception state available before field execution begins.

## Control rules

- Draft creation and assignment are separate actions.
- Approval never silently assigns a work order.
- Assignment requires a technician or vendor and a planned start time.
- Technicians see work from `ASSIGNED` onward; no `ACTIVE` status is required.
- Only the assigned technician can accept, start, pause/resume, report, and submit completion.
- A field report and at least one evidence image are required before verification.
- A rejected verification returns the work order to `IN_PROGRESS`.

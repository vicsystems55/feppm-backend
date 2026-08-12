-- Add the ticket permission catalogue entries that accompanied the support-ticket
-- feature. This is intentionally additive: existing/custom role permissions are
-- preserved and duplicate assignments are ignored.

INSERT INTO `Permission` (`id`, `key`, `description`, `createdAt`, `updatedAt`)
VALUES
  ('perm_ticket_view_20260730', 'tickets.view', 'View support tickets within the authorized scope', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm_ticket_create_20260730', 'tickets.create', 'Create support tickets and issue reports', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm_ticket_update_20260730', 'tickets.update', 'Update support tickets and add comments', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm_ticket_assign_20260730', 'tickets.assign', 'Assign support tickets within the authorized scope', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm_ticket_resolve_20260730', 'tickets.resolve', 'Resolve, verify, and close support tickets', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm_ticket_escalate_20260730', 'tickets.escalate', 'Escalate support tickets to the next administrative level', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

-- Administrative roles receive the complete ticket workflow.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT role_record.`id`, permission_record.`id`, CURRENT_TIMESTAMP(3)
FROM `Role` AS role_record
CROSS JOIN `Permission` AS permission_record
WHERE role_record.`key` IN (
  'SUPER_ADMIN',
  'NATIONAL_ADMIN',
  'ZONAL_ADMIN',
  'STATE_ADMIN',
  'LGA_ADMIN'
)
AND permission_record.`key` IN (
  'tickets.view',
  'tickets.create',
  'tickets.update',
  'tickets.assign',
  'tickets.resolve',
  'tickets.escalate'
);

-- Facility Managers can report, follow, comment on, and escalate tickets but
-- cannot assign or close them.
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT role_record.`id`, permission_record.`id`, CURRENT_TIMESTAMP(3)
FROM `Role` AS role_record
CROSS JOIN `Permission` AS permission_record
WHERE role_record.`key` = 'FACILITY_MANAGER'
AND permission_record.`key` IN (
  'tickets.view',
  'tickets.create',
  'tickets.update',
  'tickets.escalate'
);

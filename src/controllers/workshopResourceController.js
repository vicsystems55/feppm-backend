import { prisma } from '../lib/prisma.js';
import { maintenanceScope } from '../services/maintenanceAccessService.js';
import { userHasRole } from '../services/userAccessService.js';
import {
  assertToolCanBeIssued,
  assertToolCanBeReturned,
  nextAuditDate,
  normalizedToolCondition,
  statusAfterReturn,
} from '../services/workshopResourceService.js';

const personSelect = { id: true, firstName: true, lastName: true, email: true, phone: true };
const toolAssetInclude = {
  toolCatalogItem: true,
  currentCustodian: { select: personSelect },
  store: { include: { workshop: { select: { id: true, code: true, name: true, organizationId: true, administrativeUnitId: true } } } },
  custodyEvents: {
    include: { recordedBy: { select: personSelect }, custodian: { select: personSelect } },
    orderBy: { occurredAt: 'desc' },
    take: 10,
  },
};

function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
function decimal(value) { return value === null || value === undefined ? null : Number(value); }

async function workshopWhere(user) {
  if (userHasRole(user, 'SUPER_ADMIN')) return {};
  const scope = await maintenanceScope(user);
  return {
    organizationId: user.organization.id,
    administrativeUnit: { is: scope.administrativeUnitWhere },
  };
}

async function accessibleWorkshop(id, user) {
  if (!id) return null;
  return prisma.maintenanceWorkshop.findFirst({ where: { id, ...(await workshopWhere(user)), status: 'ACTIVE' } });
}

async function accessibleStore(id, user) {
  if (!id) return null;
  return prisma.workshopStore.findFirst({
    where: { id, status: 'ACTIVE', workshop: { is: { ...(await workshopWhere(user)), status: 'ACTIVE' } } },
    include: { workshop: true },
  });
}

async function accessibleToolAsset(id, user) {
  return prisma.toolAsset.findFirst({
    where: { id, store: { is: { workshop: { is: { ...(await workshopWhere(user)), status: 'ACTIVE' } } } } },
    include: toolAssetInclude,
  });
}

function serializeBalance(balance) {
  return {
    ...balance,
    quantityOnHand: decimal(balance.quantityOnHand),
    quantityReserved: decimal(balance.quantityReserved),
    reorderLevel: decimal(balance.reorderLevel),
    quantityAvailable: decimal(balance.quantityOnHand) - decimal(balance.quantityReserved),
  };
}

export async function getWorkshopResourceOverview(request, response) {
  const scopedWhere = await workshopWhere(request.authUser);
  const workshops = await prisma.maintenanceWorkshop.findMany({
    where: { ...scopedWhere, status: 'ACTIVE' },
    include: {
      administrativeUnit: { select: { id: true, name: true, type: true } },
      organization: { select: { id: true, name: true } },
      staffAssignments: {
        where: { status: 'ACTIVE' },
        include: { user: { select: personSelect } },
        orderBy: { position: 'asc' },
      },
      stores: {
        where: { status: 'ACTIVE' },
        include: {
          _count: { select: { toolAssets: true, stockBalances: true } },
          toolAssets: { select: { status: true, condition: true } },
          stockBalances: { select: { quantityOnHand: true, quantityReserved: true, reorderLevel: true } },
        },
        orderBy: { name: 'asc' },
      },
      kitAssignments: {
        where: { status: 'ACTIVE' },
        include: {
          kitTemplate: {
            include: {
              items: { include: { toolCatalogItem: true }, orderBy: { toolCatalogItem: { name: 'asc' } } },
            },
          },
        },
      },
    },
    orderBy: [{ administrativeUnit: { name: 'asc' } }, { name: 'asc' }],
  });

  let toolAssets = 0;
  let availableTools = 0;
  let issuedTools = 0;
  let toolsNeedingAttention = 0;
  let stockedParts = 0;
  let lowStockParts = 0;
  for (const workshop of workshops) {
    for (const store of workshop.stores) {
      toolAssets += store.toolAssets.length;
      availableTools += store.toolAssets.filter(({ status }) => status === 'AVAILABLE').length;
      issuedTools += store.toolAssets.filter(({ status }) => ['ISSUED', 'IN_USE'].includes(status)).length;
      toolsNeedingAttention += store.toolAssets.filter(({ status, condition }) => ['UNDER_REPAIR', 'LOST'].includes(status) || ['POOR', 'DAMAGED', 'UNSERVICEABLE'].includes(condition)).length;
      stockedParts += store.stockBalances.filter(({ quantityOnHand }) => decimal(quantityOnHand) > 0).length;
      lowStockParts += store.stockBalances.filter(({ quantityOnHand, quantityReserved, reorderLevel }) => decimal(quantityOnHand) - decimal(quantityReserved) <= decimal(reorderLevel)).length;
    }
  }

  response.json({
    success: true,
    data: {
      summary: { workshops: workshops.length, stores: workshops.reduce((sum, item) => sum + item.stores.length, 0), toolAssets, availableTools, issuedTools, toolsNeedingAttention, stockedParts, lowStockParts },
      workshops,
    },
  });
}

export async function getWorkshopStore(request, response) {
  const store = await accessibleStore(request.params.storeId, request.authUser);
  if (!store) throw httpError(404, 'Store not found in your authorized workshop scope.');

  const [balances, recentMovements] = await Promise.all([
    prisma.stockBalance.findMany({ where: { storeId: store.id }, include: { sparePart: true }, orderBy: { sparePart: { name: 'asc' } } }),
    prisma.inventoryMovement.findMany({ where: { storeId: store.id }, include: { sparePart: true, recordedBy: { select: personSelect } }, orderBy: { occurredAt: 'desc' }, take: 50 }),
  ]);
  response.json({ success: true, data: { store, balances: balances.map(serializeBalance), recentMovements: recentMovements.map((movement) => ({ ...movement, quantity: decimal(movement.quantity), unitCost: decimal(movement.unitCost) })) } });
}

export async function listWorkshopTools(request, response) {
  const scopedWhere = await workshopWhere(request.authUser);
  const search = clean(request.query.search, 100);
  const status = clean(request.query.status, 30).toUpperCase();
  const allowedStatuses = ['AVAILABLE', 'RESERVED', 'ISSUED', 'IN_USE', 'UNDER_REPAIR', 'LOST', 'RETIRED'];
  if (status && !allowedStatuses.includes(status)) throw httpError(400, 'Tool status filter is invalid.');
  const where = {
    store: { is: { ...(request.query.storeId ? { id: request.query.storeId } : {}), workshop: { is: { ...scopedWhere, status: 'ACTIVE' } } } },
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ assetTag: { contains: search, mode: 'insensitive' } }, { serialNumber: { contains: search, mode: 'insensitive' } }, { toolCatalogItem: { is: { name: { contains: search, mode: 'insensitive' } } } }] } : {}),
  };
  const assets = await prisma.toolAsset.findMany({ where, include: toolAssetInclude, orderBy: [{ status: 'asc' }, { assetTag: 'asc' }] });
  response.json({ success: true, data: { assets } });
}

export async function getWorkshopResourceOptions(request, response) {
  const workshop = await accessibleWorkshop(request.query.workshopId, request.authUser);
  if (!workshop) throw httpError(404, 'Workshop not found in your authorized scope.');
  const [catalog, recipients] = await Promise.all([
    prisma.toolCatalogItem.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: {
        organizationId: workshop.organizationId,
        status: 'ACTIVE',
        OR: [
          { workshopAssignments: { some: { workshopId: workshop.id, status: 'ACTIVE' } } },
          { roles: { some: { role: { key: { in: ['TECHNICIAN', 'VENDOR_TECHNICIAN'] } } } } },
        ],
      },
      select: personSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ]);
  response.json({ success: true, data: { catalog, recipients } });
}

export async function receiveWorkshopTool(request, response) {
  const store = await accessibleStore(request.body?.storeId, request.authUser);
  if (!store) throw httpError(404, 'Store not found in your authorized workshop scope.');
  const catalogItem = await prisma.toolCatalogItem.findFirst({ where: { id: request.body?.toolCatalogItemId, status: 'ACTIVE' } });
  if (!catalogItem) throw httpError(400, 'Select a valid tool catalogue item.');
  const assetTag = clean(request.body?.assetTag, 80).toUpperCase();
  if (!assetTag) throw httpError(400, 'Asset tag is required.');
  const condition = normalizedToolCondition(request.body?.condition, 'NEW');
  const acquiredAt = request.body?.acquiredAt ? new Date(request.body.acquiredAt) : new Date();
  if (Number.isNaN(acquiredAt.getTime())) throw httpError(400, 'Acquisition date is invalid.');

  try {
    const asset = await prisma.$transaction(async (transaction) => {
      const created = await transaction.toolAsset.create({
        data: {
          storeId: store.id,
          toolCatalogItemId: catalogItem.id,
          assetTag,
          serialNumber: clean(request.body?.serialNumber, 120) || null,
          condition,
          status: 'AVAILABLE',
          acquiredAt,
          nextAuditDueAt: nextAuditDate(acquiredAt, catalogItem.defaultAuditIntervalMonths),
        },
      });
      await transaction.toolCustodyEvent.create({
        data: { toolAssetId: created.id, recordedById: request.authUser.id, action: 'RECEIVED', condition, referenceNumber: clean(request.body?.referenceNumber, 100) || null, notes: clean(request.body?.notes, 3000) || null },
      });
      return created;
    });
    response.status(201).json({ success: true, message: 'Tool received into the workshop store.', data: { asset: await accessibleToolAsset(asset.id, request.authUser) } });
  } catch (error) {
    if (error.code === 'P2002') throw httpError(409, 'That tool asset tag already exists.');
    throw error;
  }
}

export async function issueWorkshopTool(request, response) {
  const asset = await accessibleToolAsset(request.params.assetId, request.authUser);
  if (!asset) throw httpError(404, 'Tool not found in your authorized workshop scope.');
  assertToolCanBeIssued(asset);
  const recipient = await prisma.user.findFirst({
    where: {
      id: request.body?.custodianId,
      organizationId: asset.store.workshop.organizationId,
      status: 'ACTIVE',
      OR: [
        { workshopAssignments: { some: { workshopId: asset.store.workshop.id, status: 'ACTIVE' } } },
        { roles: { some: { role: { key: { in: ['TECHNICIAN', 'VENDOR_TECHNICIAN'] } } } } },
      ],
    },
    select: personSelect,
  });
  if (!recipient) throw httpError(400, 'Select an eligible workshop staff member or technician.');

  await prisma.$transaction(async (transaction) => {
    const result = await transaction.toolAsset.updateMany({ where: { id: asset.id, status: 'AVAILABLE', currentCustodianId: null }, data: { status: 'ISSUED', currentCustodianId: recipient.id } });
    if (result.count !== 1) throw httpError(409, 'This tool was issued by another user. Refresh and try again.');
    await transaction.toolCustodyEvent.create({ data: { toolAssetId: asset.id, recordedById: request.authUser.id, custodianId: recipient.id, action: 'ISSUED', condition: asset.condition, referenceNumber: clean(request.body?.referenceNumber, 100) || null, notes: clean(request.body?.notes, 3000) || null } });
  });
  response.json({ success: true, message: `Tool issued to ${recipient.firstName} ${recipient.lastName}.`, data: { asset: await accessibleToolAsset(asset.id, request.authUser) } });
}

export async function returnWorkshopTool(request, response) {
  const asset = await accessibleToolAsset(request.params.assetId, request.authUser);
  if (!asset) throw httpError(404, 'Tool not found in your authorized workshop scope.');
  assertToolCanBeReturned(asset);
  const condition = normalizedToolCondition(request.body?.condition, asset.condition);
  const status = statusAfterReturn(condition);
  const custodianId = asset.currentCustodianId;
  await prisma.$transaction([
    prisma.toolAsset.update({ where: { id: asset.id }, data: { status, condition, currentCustodianId: null } }),
    prisma.toolCustodyEvent.create({ data: { toolAssetId: asset.id, recordedById: request.authUser.id, custodianId, action: 'RETURNED', condition, referenceNumber: clean(request.body?.referenceNumber, 100) || null, notes: clean(request.body?.notes, 3000) || null } }),
  ]);
  response.json({ success: true, message: status === 'UNDER_REPAIR' ? 'Tool returned and flagged for repair.' : 'Tool returned to the store.', data: { asset: await accessibleToolAsset(asset.id, request.authUser) } });
}

export async function auditWorkshopTool(request, response) {
  const asset = await accessibleToolAsset(request.params.assetId, request.authUser);
  if (!asset) throw httpError(404, 'Tool not found in your authorized workshop scope.');
  const condition = normalizedToolCondition(request.body?.condition, asset.condition);
  const auditedAt = new Date();
  const nextAuditDueAt = nextAuditDate(auditedAt, asset.toolCatalogItem.defaultAuditIntervalMonths);
  await prisma.$transaction([
    prisma.toolAsset.update({ where: { id: asset.id }, data: { condition, lastAuditedAt: auditedAt, nextAuditDueAt } }),
    prisma.toolCustodyEvent.create({ data: { toolAssetId: asset.id, recordedById: request.authUser.id, custodianId: asset.currentCustodianId, action: 'AUDITED', condition, referenceNumber: clean(request.body?.referenceNumber, 100) || null, notes: clean(request.body?.notes, 3000) || null, occurredAt: auditedAt } }),
  ]);
  response.json({ success: true, message: 'Tool audit recorded.', data: { asset: await accessibleToolAsset(asset.id, request.authUser) } });
}

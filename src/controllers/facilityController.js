import { prisma } from '../lib/prisma.js';
import { resolveFacilityAccess } from '../services/facilityAccessService.js';

function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function serializeFacility(facility) {
  const unit = facility.administrativeUnit;
  const lga = unit?.type === 'LGA' ? unit : unit?.parent?.type === 'LGA' ? unit.parent : null;
  const primaryContact = facility.contacts?.find((contact) => contact.isPrimary) ?? facility.contacts?.[0] ?? null;
  return {
    ...facility,
    latitude: facility.latitude === null ? null : Number(facility.latitude),
    longitude: facility.longitude === null ? null : Number(facility.longitude),
    ward: unit?.type === 'WARD' ? { id: unit.id, name: unit.name } : null,
    lga: lga ? { id: lga.id, name: lga.name } : null,
    primaryContact,
    administrativeUnit: undefined,
    contacts: undefined,
  };
}

function normalizedTreeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed';
}

function facilityTreeFilters(request, access) {
  const search = String(request.query.search ?? '').trim().slice(0, 100);
  const status = ['ACTIVE', 'INACTIVE'].includes(request.query.status) ? request.query.status : undefined;
  const facilityTypes = ['PRIMARY_HEALTH_CENTRE', 'GENERAL_HOSPITAL', 'TEACHING_HOSPITAL', 'SPECIALIST_HOSPITAL', 'LABORATORY', 'WAREHOUSE', 'HEALTH_POST', 'OTHER'];
  const requestedType = String(request.query.facilityType ?? '').trim();
  const facilityType = facilityTypes.includes(requestedType) ? requestedType : undefined;
  const lgaId = String(request.query.lgaId ?? '').trim() || undefined;
  const conditions = [];

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search } },
        { facilityCode: { contains: search } },
        { address: { contains: search } },
      ],
    });
  }
  if (lgaId) {
    conditions.push({
      OR: [
        { administrativeUnitId: lgaId },
        { administrativeUnit: { parentId: lgaId } },
      ],
    });
  }

  return {
    ...access.facilityWhere,
    ...(conditions.length ? { AND: conditions } : {}),
    ...(status ? { status } : {}),
    ...(facilityType ? { facilityType } : {}),
  };
}

function branchFor(siblings, parentKey, unit) {
  const segment = `${unit.type.toLowerCase()}-${normalizedTreeKey(unit.name)}`;
  const key = parentKey ? `${parentKey}/${segment}` : segment;
  if (!siblings.has(key)) {
    siblings.set(key, {
      key,
      label: unit.name,
      type: unit.type,
      childrenByKey: new Map(),
    });
  }
  return siblings.get(key);
}

const treeTypeOrder = {
  NATIONAL: 0,
  ZONE: 1,
  REGION: 2,
  STATE: 3,
  LGA: 4,
  DISTRICT: 5,
  WARD: 6,
  OTHER: 7,
  FACILITY: 8,
};

function finalizeTree(siblings) {
  return [...siblings.values()]
    .sort((left, right) => (
      (treeTypeOrder[left.type] ?? 99) - (treeTypeOrder[right.type] ?? 99)
      || left.label.localeCompare(right.label)
    ))
    .map((node) => {
      if (node.type === 'FACILITY') return node;
      const children = finalizeTree(node.childrenByKey);
      return {
        key: node.key,
        label: node.label,
        type: node.type,
        facilityCount: children.reduce(
          (total, child) => total + (child.type === 'FACILITY' ? 1 : child.facilityCount),
          0,
        ),
        children,
      };
    });
}

export async function getFacilityTree(request, response) {
  const access = await resolveFacilityAccess(request.authUser);
  const [units, facilities] = await Promise.all([
    prisma.administrativeUnit.findMany({
      where: access.administrativeUnitWhere,
      select: {
        id: true,
        parentId: true,
        name: true,
        type: true,
        organizationId: true,
      },
    }),
    prisma.facility.findMany({
      where: facilityTreeFilters(request, access),
      select: {
        id: true,
        organizationId: true,
        administrativeUnitId: true,
        name: true,
        facilityCode: true,
        facilityType: true,
        status: true,
        _count: { select: { equipment: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const tree = new Map();

  facilities.forEach((facility) => {
    const path = [];
    const visited = new Set();
    let unit = unitsById.get(facility.administrativeUnitId);

    while (unit && !visited.has(unit.id)) {
      path.push(unit);
      visited.add(unit.id);
      unit = unit.parentId ? unitsById.get(unit.parentId) : null;
    }
    path.reverse();

    let siblings = tree;
    let parentKey = '';
    let parentNode = null;
    path.forEach((pathUnit) => {
      parentNode = branchFor(siblings, parentKey, pathUnit);
      parentKey = parentNode.key;
      siblings = parentNode.childrenByKey;
    });

    if (parentNode?.type === 'LGA') {
      parentNode = branchFor(siblings, parentKey, {
        name: 'Ward not assigned',
        type: 'WARD',
      });
      parentKey = parentNode.key;
      siblings = parentNode.childrenByKey;
    }

    const facilityKey = `${parentKey || 'unassigned'}/facility-${facility.id}`;
    siblings.set(facilityKey, {
      key: facilityKey,
      label: facility.name,
      type: 'FACILITY',
      facility: {
        id: facility.id,
        name: facility.name,
        facilityCode: facility.facilityCode,
        facilityType: facility.facilityType,
        status: facility.status,
        equipmentCount: facility._count.equipment,
      },
    });
  });

  return response.json({
    success: true,
    data: {
      tree: finalizeTree(tree),
      facilityCount: facilities.length,
    },
  });
}

export async function listFacilities(request, response) {
  const page = integer(request.query.page, 1, 1, 100000);
  const pageSize = integer(request.query.pageSize, 20, 5, 100);
  const search = String(request.query.search ?? '').trim().slice(0, 100);
  const status = ['ACTIVE', 'INACTIVE'].includes(request.query.status) ? request.query.status : undefined;
  const facilityTypes = ['PRIMARY_HEALTH_CENTRE', 'GENERAL_HOSPITAL', 'TEACHING_HOSPITAL', 'SPECIALIST_HOSPITAL', 'LABORATORY', 'WAREHOUSE', 'HEALTH_POST', 'OTHER'];
  const requestedType = String(request.query.facilityType ?? '').trim();
  const facilityType = facilityTypes.includes(requestedType) ? requestedType : undefined;
  const lgaId = String(request.query.lgaId ?? '').trim() || undefined;
  const access = await resolveFacilityAccess(request.authUser);
  const conditions = [];
  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search } },
        { facilityCode: { contains: search } },
        { address: { contains: search } },
      ],
    });
  }
  if (lgaId) {
    conditions.push({
      OR: [
        { administrativeUnitId: lgaId },
        { administrativeUnit: { parentId: lgaId } },
      ],
    });
  }
  const filters = {
    ...access.facilityWhere,
    ...(conditions.length ? { AND: conditions } : {}),
    ...(status ? { status } : {}),
    ...(facilityType ? { facilityType } : {}),
  };

  const [total, facilities, active, inactive, withCoordinates, lgas] = await Promise.all([
    prisma.facility.count({ where: filters }),
    prisma.facility.findMany({
      where: filters,
      orderBy: [{ name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        administrativeUnit: { include: { parent: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }] },
        _count: { select: { equipment: true, departments: true } },
      },
    }),
    prisma.facility.count({ where: { ...access.facilityWhere, status: 'ACTIVE' } }),
    prisma.facility.count({ where: { ...access.facilityWhere, status: 'INACTIVE' } }),
    prisma.facility.count({ where: { ...access.facilityWhere, latitude: { not: null }, longitude: { not: null } } }),
    prisma.administrativeUnit.findMany({
      where: { ...access.administrativeUnitWhere, type: 'LGA' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return response.json({
    success: true,
    data: {
      facilities: facilities.map(serializeFacility),
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      summary: { total: active + inactive, active, inactive, withCoordinates },
      filters: { lgas },
    },
  });
}

export async function getFacility(request, response) {
  const access = await resolveFacilityAccess(request.authUser);
  const facility = await prisma.facility.findFirst({
    where: { ...access.facilityWhere, id: request.params.id },
    include: {
      organization: { select: { id: true, name: true } },
      administrativeUnit: { include: { parent: { include: { parent: true } } } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }] },
      departments: { select: { id: true, name: true, code: true, status: true } },
      _count: { select: { equipment: true, users: true, tasks: true, alerts: true } },
    },
  });

  if (!facility) return response.status(404).json({ success: false, message: 'Facility not found.' });
  const serialized = serializeFacility(facility);
  serialized.contacts = facility.contacts;
  return response.json({ success: true, data: { facility: serialized } });
}

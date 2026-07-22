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

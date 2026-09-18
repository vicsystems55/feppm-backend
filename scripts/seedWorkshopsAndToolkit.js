import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE_DOCUMENT = 'Basic Toolkit for R134a R600a Refrigerant systems R1 (1).docx';
const KIT_CODE = 'R134A-R600A-BASIC-TOOLKIT-R1';
const DEFAULT_DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Demo@FEPPM2026';

const stateSetups = [
  {
    stateName: 'Gombe',
    workshopCode: 'GOMBE-CENTRAL-WORKSHOP',
    workshopName: 'Gombe State Maintenance Workshop',
    storeCode: 'GOMBE-CENTRAL-STORE',
    storeName: 'Gombe State Maintenance Store',
    manager: {
      email: 'workshop.manager@feppm.demo',
      firstName: 'Workshop',
      lastName: 'Manager',
      roleKey: 'WORKSHOP_MANAGER',
      position: 'WORKSHOP_MANAGER',
    },
    storekeeper: {
      email: 'store.keeper@feppm.demo',
      firstName: 'Store',
      lastName: 'Keeper',
      roleKey: 'STOREKEEPER',
      position: 'STOREKEEPER',
    },
  },
  {
    stateName: 'Anambra',
    workshopCode: 'ANAMBRA-CENTRAL-WORKSHOP',
    workshopName: 'Anambra State Maintenance Workshop',
    storeCode: 'ANAMBRA-CENTRAL-STORE',
    storeName: 'Anambra State Maintenance Store',
    manager: {
      email: 'anambra.workshop.manager@feppm.demo',
      firstName: 'Anambra Workshop',
      lastName: 'Manager',
      roleKey: 'WORKSHOP_MANAGER',
      position: 'WORKSHOP_MANAGER',
    },
    storekeeper: {
      email: 'anambra.store.keeper@feppm.demo',
      firstName: 'Anambra Store',
      lastName: 'Keeper',
      roleKey: 'STOREKEEPER',
      position: 'STOREKEEPER',
    },
  },
];

const tools = [
  {
    code: 'TOOL-CLAMP-METER-TEMP',
    name: 'Clamp-on multimeter with temperature probe',
    category: 'Electrical diagnostics',
    specification: 'Auto-ranging TRMS clamp meter for AC/DC current and voltage, resistance, continuity, frequency, capacitance, diode testing, LoZ mode and thermocouple temperature measurement; CAT IV 600V / CAT III 1000V.',
    unitOfMeasure: 'piece',
    calibrationRequired: true,
    qualityStandard: 'UL/CSA/IEC EN 61010 and IEC EN 61326-1 or equivalent',
  },
  {
    code: 'TOOL-VERNIER-CALIPER-150',
    name: 'Vernier caliper, 150 mm',
    category: 'Measurement',
    specification: 'Analogue high-carbon-steel caliper, 150 mm capacity, 0.02 mm resolution, locking thumb screw and storage case.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-MEASURING-TAPE-7M',
    name: 'Measuring tape, 7 m',
    category: 'Measurement',
    specification: 'Minimum 7 m tape in impact-resistant ABS case with shock absorption; magnetic hook and level gauge optional.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-RATCHET-SPANNER-8-19',
    name: 'Fixed-head combination ratchet spanner set, 8–19 mm',
    category: 'Hand tools',
    specification: 'Twelve metric fixed-head ratchet spanners covering 8–19 mm, approximately 5-degree return angle, supplied in a portable case.',
    unitOfMeasure: 'set',
    packContents: '12 fixed-head spanners in one case',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-ADJUSTABLE-WRENCH-380',
    name: 'Adjustable wrench, 380 mm',
    category: 'Hand tools',
    specification: 'Approximately 380 mm adjustable wrench with heat-treated jaws, 15-degree head, knurled adjustment and roughly 44 mm jaw capacity.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-MULTIGRIP-PLIER',
    name: 'Locking multi-grip plier',
    category: 'Hand tools',
    specification: 'Twin slip-joint multi-grip plier with push-button adjustment, safety lock, ergonomic grips and high-frequency-treated jaws.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-NEEDLE-NOSE-PLIER',
    name: 'Needle-nose plier',
    category: 'Hand tools',
    specification: 'Anti-corrosion alloy-steel needle-nose plier with serrated jaws, insulated ergonomic grip and cutting edges for soft wire.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO 5745 or equivalent',
  },
  {
    code: 'TOOL-SIDE-CUTTING-PLIER',
    name: 'Side-cutting plier',
    category: 'Hand tools',
    specification: 'Approximately 125 mm side cutter with induction-hardened progressive cutting edges, ergonomic grip and anti-corrosion finish.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO 5749 or equivalent',
  },
  {
    code: 'TOOL-SOCKET-RATCHET-SET',
    name: 'Socket set with ratchet wrench',
    category: 'Hand tools',
    specification: '1/4-inch round-head ratchet, metric sockets from 4–14 mm, drive bit adapter and specialty bit rail.',
    unitOfMeasure: 'set',
    packContents: 'Ratchet, 11 metric sockets, bit adapter and 11-piece specialty bit rail',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-SCREWDRIVER-SLOTTED-5-5',
    name: 'Slotted screwdriver, 5.5 mm tip',
    category: 'Hand tools',
    specification: 'Slotted screwdriver with 5.5 mm tip, 100 mm vanadium-steel blade and approximately 222 mm overall length.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO 2380-1 and ISO 2380-2 or equivalent',
  },
  {
    code: 'TOOL-SCREWDRIVER-SLOTTED-2-5',
    name: 'Slotted screwdriver, 2.5 mm tip',
    category: 'Hand tools',
    specification: 'Slotted screwdriver with 2.5 mm tip, 100 mm vanadium-steel blade and ergonomic insulated handle.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO 2380-1 and ISO 2380-2 or equivalent',
  },
  {
    code: 'TOOL-SCREWDRIVER-PHILLIPS-PH0',
    name: 'Phillips screwdriver, PH0',
    category: 'Hand tools',
    specification: 'PH0 cross-head screwdriver with approximately 60 mm vanadium-steel blade and ergonomic handle.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO 2380 or equivalent',
  },
  {
    code: 'TOOL-VOLTAGE-TESTER-PEN',
    name: 'Electrical voltage tester pen',
    category: 'Electrical diagnostics',
    specification: 'Transparent insulated slotted-tip neon voltage tester for approximately 100–500 V.',
    unitOfMeasure: 'piece',
    qualityStandard: 'CE/ISO or equivalent',
  },
  {
    code: 'TOOL-FLAT-FILE-150',
    name: 'Flat file, 150 mm',
    category: 'Hand tools',
    specification: '150 mm ergonomic flat file with tapered edges, double-cut surfaces and single-cut edges.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-ROUND-FILE-320',
    name: 'Round file, 320 mm',
    category: 'Hand tools',
    specification: 'Approximately 320 mm tapered round file for holes, fillets and concave surfaces, with ergonomic handle.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-WIRE-BRUSH-SET-6',
    name: 'Wire brush set',
    category: 'Cleaning tools',
    specification: 'Mixed brass, stainless-steel and nylon brushes in standard and mini sizes for rust and component cleaning.',
    unitOfMeasure: 'set',
    packContents: '6 brushes: 3 standard and 3 mini in brass, stainless steel and nylon',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-ALLEN-KEY-SAE-METRIC',
    name: 'SAE and metric Allen key set',
    category: 'Hand tools',
    specification: 'Magnetic ball-plus hex key set covering inch sizes 0.050–3/8 and metric sizes 1.5–10 mm.',
    unitOfMeasure: 'set',
    qualityStandard: 'CE/ISO/ANSI or equivalent',
  },
  {
    code: 'TOOL-JUNIOR-HACKSAW-150',
    name: 'Junior hacksaw with spare blades',
    category: 'Cutting tools',
    specification: 'Junior hacksaw with 150 mm, 32-TPI metal-cutting blade and powder-coated steel frame.',
    unitOfMeasure: 'set',
    packContents: '1 hacksaw plus 10 spare 150 mm blades',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-STEEL-HAMMER-200G',
    name: 'Steel hammer, 200 g',
    category: 'Hand tools',
    specification: '200 g mounting hammer with hardened square face and lacquer-treated ash shaft.',
    unitOfMeasure: 'piece',
    qualityStandard: 'DIN 1041, GS and ISO 15601 or equivalent',
  },
  {
    code: 'TOOL-PLASTIC-HAMMER-35',
    name: 'Plastic hammer, 35 mm',
    category: 'Hand tools',
    specification: '35 mm polyurethane-elastomer plastic hammer with cast-iron centre and wooden handle for assembly and shaping work.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO 15601 or equivalent',
  },
  {
    code: 'PPE-SAFETY-GOGGLE-ANTIFOG',
    name: 'Clear anti-fog safety goggles',
    category: 'Personal protective equipment',
    specification: 'Dual-mould clear anti-fog goggles with impact-resistant polycarbonate lens, ventilation and adjustable elastic headband.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ANSI Z87.1+ or equivalent; 99.9% UVA/UVB protection',
  },
  {
    code: 'TOOL-SOLDERING-IRON-60W',
    name: 'Adjustable soldering iron, 60 W',
    category: 'Electrical repair',
    specification: 'Adjustable-temperature 60 W electric soldering iron suitable for 220 V/50 Hz, with interchangeable tips.',
    unitOfMeasure: 'set',
    packContents: '1 soldering iron with 5 tips',
    qualityStandard: 'ISO/CE or equivalent',
  },
  {
    code: 'TOOL-FIN-STRAIGHTENER',
    name: 'Condenser and evaporator fin straightener',
    category: 'Refrigeration service',
    specification: 'Six-sided fin comb for cleaning and straightening condenser and evaporator fins at 8, 9, 10, 12, 14 and 15 fins per inch.',
    unitOfMeasure: 'piece',
    qualityStandard: 'CE/ISO/ANSI or equivalent',
  },
  {
    code: 'TOOL-PORTABLE-TOOLBOX',
    name: 'Portable lockable toolbox',
    category: 'Storage',
    specification: 'Robust portable toolbox with lid organizers, tote tray, padlock eye, coated handle and plated latches.',
    unitOfMeasure: 'piece',
    qualityStandard: 'ISO/CE or equivalent',
  },
];

async function findStateSetup(stateName) {
  const states = await prisma.administrativeUnit.findMany({
    where: { type: 'STATE', name: { equals: stateName, mode: 'insensitive' }, status: 'ACTIVE' },
    include: { organization: true },
  });

  if (states.length !== 1) {
    throw new Error(`Expected exactly one active ${stateName} state record; found ${states.length}.`);
  }

  return states[0];
}

async function ensureStaffUser({ staff, state }) {
  const existing = await prisma.user.findUnique({ where: { email: staff.email } });
  if (existing && existing.organizationId !== state.organizationId) {
    throw new Error(`${staff.email} belongs to another organization and cannot be assigned to ${state.name}.`);
  }

  const passwordHash = existing?.passwordHash || await bcrypt.hash(DEFAULT_DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: staff.email },
    update: {
      firstName: staff.firstName,
      lastName: staff.lastName,
      facilityId: null,
      status: 'ACTIVE',
    },
    create: {
      organizationId: state.organizationId,
      facilityId: null,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      passwordHash,
      status: 'ACTIVE',
    },
  });

  const role = await prisma.role.findUnique({ where: { key: staff.roleKey } });
  if (!role) throw new Error(`Missing ${staff.roleKey} role. Run npm run seed:access-control first.`);

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  await prisma.userScope.upsert({
    where: { userId_administrativeUnitId: { userId: user.id, administrativeUnitId: state.id } },
    update: {},
    create: { userId: user.id, administrativeUnitId: state.id },
  });

  return user;
}

async function seedToolkit() {
  const kit = await prisma.workshopKitTemplate.upsert({
    where: { code: KIT_CODE },
    update: {
      name: 'Basic Toolkit for R134a and R600a Refrigerant Systems',
      description: 'Required baseline toolkit for workshop refrigeration maintenance. Assignment does not imply physical receipt or availability.',
      sourceDocument: SOURCE_DOCUMENT,
      refrigerantSystems: ['R134a', 'R600a'],
      expectedUsefulLifeYears: 5,
      defaultAuditIntervalMonths: 6,
      status: 'ACTIVE',
    },
    create: {
      code: KIT_CODE,
      name: 'Basic Toolkit for R134a and R600a Refrigerant Systems',
      description: 'Required baseline toolkit for workshop refrigeration maintenance. Assignment does not imply physical receipt or availability.',
      sourceDocument: SOURCE_DOCUMENT,
      refrigerantSystems: ['R134a', 'R600a'],
      expectedUsefulLifeYears: 5,
      defaultAuditIntervalMonths: 6,
      status: 'ACTIVE',
    },
  });

  for (const tool of tools) {
    const { packContents, ...catalogData } = tool;
    const catalogItem = await prisma.toolCatalogItem.upsert({
      where: { code: tool.code },
      update: {
        ...catalogData,
        expectedUsefulLifeYears: 5,
        defaultAuditIntervalMonths: 6,
        status: 'ACTIVE',
      },
      create: {
        ...catalogData,
        expectedUsefulLifeYears: 5,
        defaultAuditIntervalMonths: 6,
        status: 'ACTIVE',
      },
    });
    await prisma.workshopKitItem.upsert({
      where: {
        kitTemplateId_toolCatalogItemId: {
          kitTemplateId: kit.id,
          toolCatalogItemId: catalogItem.id,
        },
      },
      update: { requiredQuantity: 1, packContents: packContents || null },
      create: {
        kitTemplateId: kit.id,
        toolCatalogItemId: catalogItem.id,
        requiredQuantity: 1,
        packContents: packContents || null,
      },
    });
  }

  return kit;
}

async function main() {
  const kit = await seedToolkit();
  const results = [];

  for (const setup of stateSetups) {
    const state = await findStateSetup(setup.stateName);
    const workshop = await prisma.maintenanceWorkshop.upsert({
      where: {
        organizationId_code: {
          organizationId: state.organizationId,
          code: setup.workshopCode,
        },
      },
      update: {
        administrativeUnitId: state.id,
        name: setup.workshopName,
        status: 'ACTIVE',
      },
      create: {
        organizationId: state.organizationId,
        administrativeUnitId: state.id,
        code: setup.workshopCode,
        name: setup.workshopName,
        status: 'ACTIVE',
      },
    });

    const store = await prisma.workshopStore.upsert({
      where: { workshopId_code: { workshopId: workshop.id, code: setup.storeCode } },
      update: { name: setup.storeName, type: 'GENERAL', status: 'ACTIVE' },
      create: {
        workshopId: workshop.id,
        code: setup.storeCode,
        name: setup.storeName,
        type: 'GENERAL',
        status: 'ACTIVE',
      },
    });

    const staffMembers = [];
    for (const staff of [setup.manager, setup.storekeeper]) {
      const user = await ensureStaffUser({ staff, state });
      await prisma.workshopStaffAssignment.upsert({
        where: {
          workshopId_userId_position: {
            workshopId: workshop.id,
            userId: user.id,
            position: staff.position,
          },
        },
        update: { isPrimary: true, endsAt: null, status: 'ACTIVE' },
        create: {
          workshopId: workshop.id,
          userId: user.id,
          position: staff.position,
          isPrimary: true,
          status: 'ACTIVE',
        },
      });
      staffMembers.push(user.email);
    }

    await prisma.workshopKitAssignment.upsert({
      where: { workshopId_kitTemplateId: { workshopId: workshop.id, kitTemplateId: kit.id } },
      update: { status: 'ACTIVE' },
      create: { workshopId: workshop.id, kitTemplateId: kit.id, status: 'ACTIVE' },
    });

    results.push({ state: state.name, workshop: workshop.name, store: store.name, staff: staffMembers });
  }

  console.log(JSON.stringify({
    success: true,
    workshops: results,
    toolkit: { code: KIT_CODE, itemCount: tools.length, actualToolAssetsCreated: 0 },
    sparePartsCreated: 0,
    note: 'This source document contains tools, not spare parts. Actual stock remains empty until receipt or stock count.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

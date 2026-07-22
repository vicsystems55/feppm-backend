import { prisma } from '../src/lib/prisma.js';

const templates = [
  {
    name: 'Cold Chain Daily Care', frequencyType: 'DAILY', estimatedDurationMinutes: 12,
    items: [
      ['Observe the equipment temperature and indicator light.', 'YES_NO', 'Confirm that the temperature display and indicator light are visible and normal.'],
      ['What is the temperature at the time of inspection?', 'TEMPERATURE', 'Enter the current reading in degrees Celsius.'],
      ['Drain the water for 30 seconds to 1 minute.', 'YES_NO', 'Confirm when draining is complete.'],
      ['Check the cleanliness of the environment.', 'PASS_FAIL', 'Inspect the equipment and surrounding work area.'],
      ['Check air circulation around the equipment.', 'PASS_FAIL', 'Confirm that vents are unobstructed and air can circulate freely.'],
      ['Move back approximately 2 metres and take a picture.', 'PHOTO', 'The full equipment and immediate surroundings must be visible.'],
    ],
  },
  {
    name: 'Cold Chain Weekly Care', frequencyType: 'WEEKLY', estimatedDurationMinutes: 10,
    items: [
      ['Move back approximately 2 metres and take a picture.', 'PHOTO', 'The full equipment and immediate surroundings must be visible.'],
      ['Take a sectional photograph of the solar panels on the roof.', 'PHOTO', 'Capture enough of the array to assess condition and obstruction.'],
    ],
  },
  {
    name: 'Cold Chain Monthly Care', frequencyType: 'MONTHLY', estimatedDurationMinutes: 15,
    items: [
      ['Move back approximately 2 metres and take a picture.', 'PHOTO', 'The full equipment and immediate surroundings must be visible.'],
      ['Take a sectional photograph of the solar panels on the roof.', 'PHOTO', 'Capture enough of the array to assess condition and obstruction.'],
      ['Check the access doors around the compressor and condenser, then take a picture.', 'PHOTO', 'Capture the doors, latches, compressor, and condenser access area.'],
    ],
  },
];

async function main() {
  const category = await prisma.equipmentCategory.upsert({
    where: { name: 'Cold Chain Equipment' },
    update: {},
    create: { name: 'Cold Chain Equipment', description: 'Immunization and temperature-controlled storage equipment.' },
  });
  const equipmentType = await prisma.equipmentType.upsert({
    where: { categoryId_name: { categoryId: category.id, name: 'Solar Direct Drive Refrigerator' } },
    update: {},
    create: { categoryId: category.id, name: 'Solar Direct Drive Refrigerator', description: 'Solar-powered vaccine refrigerator.' },
  });

  for (const template of templates) {
    const existing = await prisma.checklistTemplate.findFirst({ where: { equipmentTypeId: equipmentType.id, name: template.name, version: '1.0' } });
    if (existing) continue;
    await prisma.checklistTemplate.create({
      data: {
        equipmentTypeId: equipmentType.id,
        name: template.name,
        version: '1.0',
        frequencyType: template.frequencyType,
        estimatedDurationMinutes: template.estimatedDurationMinutes,
        status: 'INACTIVE',
        items: {
          create: template.items.map(([title, inputType, instruction], index) => ({
            title, inputType, instruction, sequenceOrder: index + 1, isRequired: true,
            evidenceRequirement: ['PHOTO', 'MULTIPLE_PHOTOS'].includes(inputType) ? 'REQUIRED' : 'NONE',
          })),
        },
      },
    });
  }
  console.log('Cold-chain daily, weekly, and monthly checklist drafts are ready for Super Admin review.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

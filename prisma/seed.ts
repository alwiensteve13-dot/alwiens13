import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const regions = [
    {
      id: "1",
      name: "DAS Wae Apo",
      description: "Pulau Buru",
    },
    {
      id: "2",
      name: "DAS Way Ruhu",
      description: "Kota Ambon",
    },
    {
      id: "3",
      name: "DAS Way Ela",
      description: "Kabupaten Maluku Tengah",
    }
  ];

  for (const region of regions) {
    // In actual implementation with PostGIS, geometry would be inserted here via raw query
    // since Prisma doesn't natively support PostGIS types fully in standard create.
    await prisma.$executeRaw`
      INSERT INTO "Region" (id, name, description) 
      VALUES (${region.id}, ${region.name}, ${region.description})
      ON CONFLICT (id) DO NOTHING;
    `;
  }
  
  console.log("Seeding finished.");
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

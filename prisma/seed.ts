import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const gasCategories = [
  {
    id: "sodigaz-6",
    name: "Sodigaz 6kg",
    brand: "Sodigaz",
    weight: 6,
    price: 2000,
    imageUrl: "https://res.cloudinary.com/dqgoo3mxo/image/upload/v1781297287/sodigaz-6kg_uipzsp.png"
  },
  {
    id: "sodigaz-12",
    name: "Sodigaz 12.5kg",
    brand: "Sodigaz",
    weight: 12.5,
    price: 5500,
    imageUrl: "https://res.cloudinary.com/dqgoo3mxo/image/upload/v1781297286/sodigaz-12kg_upnejk.png"
  },
  {
    id: "oryx-6",
    name: "Oryx 6kg",
    brand: "Oryx",
    weight: 6,
    price: 2000,
    imageUrl: "https://res.cloudinary.com/dqgoo3mxo/image/upload/v1781297286/oryx-6kg_vr5hpo.png"
  },
  {
    id: "oryx-12",
    name: "Oryx 12.5kg",
    brand: "Oryx",
    weight: 12.5,
    price: 5500,
    imageUrl: "https://res.cloudinary.com/dqgoo3mxo/image/upload/v1781297286/oryx-12kg_o5kggy.png"
  },
  {
    id: "total-6",
    name: "Total 6kg",
    brand: "Total",
    weight: 6,
    price: 2000,
    imageUrl: "https://res.cloudinary.com/dqgoo3mxo/image/upload/v1781297286/total-6kg_udp11t.png"
  },
  {
    id: "total-12",
    name: "Total 12.5kg",
    brand: "Total",
    weight: 12.5,
    price: 5500,
    imageUrl: "https://res.cloudinary.com/dqgoo3mxo/image/upload/v1781297285/total-12kg_xi3su9.png"
  }
];

async function main() {
  console.log('Starting seeding gas categories...');
  
  for (const category of gasCategories) {
    await (prisma as any).gasCategory.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }
  
  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    // @ts-ignore
    if (typeof process !== 'undefined') process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

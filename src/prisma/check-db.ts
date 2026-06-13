import { PrismaClient } from '@prisma/client';
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Checking users...");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      isShopOpen: true,
      shopName: true
    }
  });
  console.log("All users:", JSON.stringify(users, null, 2));

  const sellers = await prisma.user.findMany({
    where: {
      role: 'SELLER',
      isShopOpen: true 
    },
    select: {
      id: true,
      shopName: true,
      name: true,
      shopImage: true,
      description: true,
      phone: true,
      openingHours: true
    }
  });
  console.log("Active sellers:", JSON.stringify(sellers, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

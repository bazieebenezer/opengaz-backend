import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../utils/auth";

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

async function seedAdmins() {
  console.log('Starting seeding administrators...');
  const password = 'Spck0211';
  const hashedPassword = await hashPassword(password);

  const admins = [
    { email: 'admin1@opengaz.bf', name: 'Admin 1', phone: '70000001', role: 'ADMIN' as const },
    { email: 'admin2@opengaz.bf', name: 'Admin 2', phone: '70000002', role: 'ADMIN' as const },
    { email: 'admin3@opengaz.bf', name: 'Admin 3', phone: '70000003', role: 'ADMIN' as const },
    { email: 'admin4@opengaz.bf', name: 'Admin 4', phone: '70000004', role: 'ADMIN' as const },
    { email: 'admin5@opengaz.bf', name: 'Admin 5', phone: '70000005', role: 'ADMIN' as const },
  ];

  for (const admin of admins) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: { password: hashedPassword, role: 'ADMIN' },
      create: { ...admin, password: hashedPassword },
    });
    console.log(`Administrator seeded: ${admin.email}`);
  }
}

async function main() {
  await seedGasCategories();
  await seedSellers();
  await seedAdmins();
  console.log('Seeding finished successfully!');
}


async function seedGasCategories() {
  console.log('Starting seeding gas categories...');
  for (const category of gasCategories) {
    await (prisma as any).gasCategory.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }
}

async function seedSellers() {
  console.log('Starting seeding test sellers in Abidjan...');
  const hashedPassword = await hashPassword('password123');

  const sellers = [
    {
      email: 'gaz.remblais@test.com',
      password: hashedPassword,
      name: 'Boutique Remblais',
      role: 'SELLER' as const,
      shopName: 'Koumassi Gaz Pro',
      latitude: 5.2925,
      longitude: -3.9410,
      isShopOpen: true,
      phone: '07070707',
      address: 'Koumassi Remblais',
      description: 'Spécialiste de la distribution à Koumassi Remblais.',
      selectedGases: ['sodigaz-6', 'sodigaz-12']
    },
    {
      email: 'gaz.treich@test.com',
      password: hashedPassword,
      name: 'M. Touré',
      role: 'SELLER' as const,
      shopName: 'Ets Touré & Fils - Treich',
      latitude: 5.3120,
      longitude: -4.0050,
      isShopOpen: true,
      phone: '01010101',
      address: 'Treichville Avenue 16',
      description: 'Vente de gaz et services de proximité à Treichville.',
      selectedGases: ['oryx-6', 'oryx-12', 'total-6']
    },
    {
      email: 'gaz.angre@test.com',
      password: hashedPassword,
      name: 'Awa Gaz',
      role: 'SELLER' as const,
      shopName: 'Angré Distribution',
      latitude: 5.3850,
      longitude: -3.9750,
      isShopOpen: true,
      phone: '05050505',
      address: 'Cocody Angré 7ème Tranche',
      description: 'Livraison rapide de gaz dans la zone d\'Angré.',
      selectedGases: ['total-6', 'total-12', 'sodigaz-12']
    }
  ];

  for (const sellerData of sellers) {
    const { selectedGases, ...userData } = sellerData;
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: userData,
      create: userData,
    });

    console.log(`Seeding products for ${user.shopName}...`);
    for (const categoryId of selectedGases) {
      await (prisma as any).product.upsert({
        where: {
          id: `${user.id}-${categoryId}` 
        },
        update: {
          stock: 10
        },
        create: {
          id: `${user.id}-${categoryId}`,
          sellerId: user.id,
          categoryId: categoryId,
          stock: 10
        }
      });
    }
  }
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

import prisma from './config/prisma';
import { hashPassword } from './utils/auth';

async function createAdmin() {
  const email = 'admin@opengaz.com';
  const password = 'AdminPassword123!'; // À changer après la première connexion
  const hashedPassword = await hashPassword(password);

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('Admin already exists.');
      return;
    }

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Super Admin',
        role: 'ADMIN',
        isValidated: true
      }
    });

    console.log('-----------------------------------');
    console.log('Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('-----------------------------------');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

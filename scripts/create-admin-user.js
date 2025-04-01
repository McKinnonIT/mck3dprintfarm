// This script checks for the existence of an admin user and creates one if it doesn't exist
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for admin user...');
  
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.DEFAULT_ADMIN_NAME || 'Administrator';
  
  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: {
      email: adminEmail,
    },
  });
  
  if (existingAdmin) {
    console.log(`Admin user ${adminEmail} already exists, skipping creation.`);
    return;
  }
  
  // Create admin user
  console.log(`Creating admin user ${adminEmail}...`);
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPassword, salt);
  
  // Create the user with admin role
  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  
  console.log(`Admin user created successfully with ID: ${user.id}`);
}

main()
  .catch((e) => {
    console.error('Error creating admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
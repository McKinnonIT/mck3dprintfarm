import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');
  
  // --- Find or Create Required Roles (use uppercase) ---
  const rolesToEnsure = [
    { name: 'ADMIN', description: 'Full access to all system features.', allowedPages: ['*'] },
    { name: 'USER', description: 'Default user role, can view dashboard and printers.', allowedPages: ['dashboard', 'printers'] },
    // Removed Teacher and Student roles from seed
  ];

  const roleIds: { [key: string]: string } = {};

  for (const roleData of rolesToEnsure) {
    let role = await prisma.role.findUnique({ where: { name: roleData.name } });
    if (!role) {
      console.log(`Creating role: ${roleData.name}`);
      role = await prisma.role.create({
        data: {
          name: roleData.name,
          description: roleData.description,
          allowedPages: JSON.stringify(roleData.allowedPages), // Store as JSON
        },
      });
    }
    roleIds[roleData.name] = role.id; // Store the ID
  }
  console.log('Required roles ensured.');

  // --- Ensure Admin User Exists (with Role and Hashed Password) ---
  // Use environment variables or fallbacks for admin credentials
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.DEFAULT_ADMIN_NAME || 'Administrator';
  
  const hashedPassword = await hash(adminPassword, 10);
  console.log('Hashed admin password.');

  // Admin User
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { 
      // Ensure existing admin always has the Administrator role
      roleId: roleIds['ADMIN'], 
      // Optionally update name/password on existing admin if needed?
      // name: adminName, 
      // password: hashedPassword,
    }, 
    create: {
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      role: { connect: { id: roleIds['ADMIN'] } }, // Connect role
    },
  });
  console.log(`Admin user (${adminEmail}) ensured.`);

  // Removed placeholder Teacher and Student user creation

  console.log('Seed data checked/created successfully');
}

main()
  .catch((e) => {
    console.error('Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
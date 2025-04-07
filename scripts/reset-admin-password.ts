import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetAdminPassword() {
  try {
    // Find the Administrator role
    const adminRoleName = 'Administrator';
    const adminRole = await prisma.role.findUnique({ where: { name: adminRoleName } });

    if (!adminRole) {
        throw new Error(`Role '${adminRoleName}' not found. Please run seed or ensure roles are created.`);
    }

    const hashedPassword = await bcrypt.hash('password123', 10) // Consider making the password configurable
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'; // Use consistent email source
    
    const updatedUser = await prisma.user.upsert({
      where: {
        email: adminEmail
      },
      update: {
        password: hashedPassword,
        roleId: adminRole.id // Also ensure roleId is set on update
      },
      create: {
        email: adminEmail,
        name: process.env.DEFAULT_ADMIN_NAME || 'Admin', // Use consistent name source
        password: hashedPassword,
        // role: 'admin' // Old way
        role: { connect: { id: adminRole.id } } // New way: Connect role by ID
      }
    })

    console.log('Admin password reset successfully:', updatedUser.email)
  } catch (error) {
    console.error('Error resetting admin password:', error)
    process.exit(1); // Exit with error code if reset fails
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminPassword() 
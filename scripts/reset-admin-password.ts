import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetAdminPassword() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10)
    
    const updatedUser = await prisma.user.upsert({
      where: {
        email: 'admin@example.com'
      },
      update: {
        password: hashedPassword
      },
      create: {
        email: 'admin@example.com',
        name: 'Admin',
        password: hashedPassword,
        role: 'admin'
      }
    })

    console.log('Admin password reset successfully:', updatedUser.email)
  } catch (error) {
    console.error('Error resetting admin password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminPassword() 
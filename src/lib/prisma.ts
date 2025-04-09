import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // Restore logging if it was previously enabled
  // log: ["query"],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma; 
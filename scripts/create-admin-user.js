// This script checks for the existence of an admin user and creates one if it doesn't exist
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  console.log('Starting admin user creation process...');
  console.log('Database URL:', process.env.DATABASE_URL);
  
  // Create a new PrismaClient instance with debug logging
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('Checking for admin user...');
    
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.DEFAULT_ADMIN_NAME || 'Administrator';
    
    console.log(`Using admin email: ${adminEmail}`);
    console.log(`Using admin name: ${adminName}`);
    
    // Verify database connection and schema
    try {
      console.log('Verifying database connection and schema...');
      // Check if User table exists by querying it
      const tableCheck = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='User'`;
      console.log('Table check result:', tableCheck);
      
      if (!tableCheck || tableCheck.length === 0) {
        console.error('User table does not exist in the database! Schema may not be properly initialized.');
        return;
      }
      
      console.log('Database schema verification successful.');
    } catch (schemaError) {
      console.error('Error checking database schema:', schemaError);
      throw schemaError;
    }
    
    // Check if admin user already exists
    console.log(`Checking if user ${adminEmail} already exists...`);
    
    let existingAdmin;
    try {
      existingAdmin = await prisma.user.findUnique({
        where: {
          email: adminEmail,
        },
      });
    } catch (findError) {
      console.error('Error finding existing user:', findError);
      throw findError;
    }
    
    console.log('Found user:', existingAdmin);
    
    if (existingAdmin) {
      console.log(`Admin user ${adminEmail} already exists, skipping creation.`);
      return;
    }
    
    console.log(`No user found with email: ${adminEmail}`);
    console.log(`Creating admin user ${adminEmail}...`);
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    console.log('Password hashed successfully.');
    
    // Create the user with admin role
    try {
      const user = await prisma.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          password: hashedPassword,
          role: 'ADMIN',
        },
      });
      
      console.log(`Admin user created successfully with ID: ${user.id}`);
    } catch (createError) {
      console.error('Error creating admin user:', createError);
      throw createError;
    }
  } catch (error) {
    console.error('Error in admin user creation process:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

// Execute the function
createAdminUser()
  .then(() => {
    console.log('Admin user creation process completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create admin user:', error);
    process.exit(1);
  }); 
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
    
    // Ensure Administrator Role Exists
    const adminRoleName = 'ADMIN';
    let adminRole = await prisma.role.findUnique({
      where: { name: adminRoleName },
    });

    if (!adminRole) {
      console.log(`Role '${adminRoleName}' not found, creating it...`);
      adminRole = await prisma.role.create({
        data: {
          name: adminRoleName,
          description: 'Full access to all system features.',
          // Define default allowed pages/actions for Admin
          allowedPages: JSON.stringify(['*']), // Store as JSON string
          allowedActions: JSON.stringify(['*']), // Store as JSON string
        },
      });
      console.log(`Role '${adminRoleName}' created with ID: ${adminRole.id}`);
    } else {
      console.log(`Role '${adminRoleName}' already exists with ID: ${adminRole.id}`);
      // Ensure existing ADMIN role has wildcard permissions
      if (adminRole.allowedPages !== JSON.stringify(['*']) || adminRole.allowedActions !== JSON.stringify(['*'])) {
          console.log(`Updating existing '${adminRoleName}' role to ensure wildcard page and action permissions...`);
          adminRole = await prisma.role.update({
              where: { id: adminRole.id },
              data: {
                  allowedPages: JSON.stringify(['*']),
                  allowedActions: JSON.stringify(['*'])
              }
          });
          console.log(`Role '${adminRoleName}' permissions updated.`);
      } else {
        console.log(`Role '${adminRoleName}' already has correct wildcard permissions.`);
      }
    }

    // Ensure Admin User Exists and is Assigned the Role
    console.log(`Checking if user ${adminEmail} already exists...`);
    let existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log(`Admin user ${adminEmail} already exists.`);
      // Check if existing admin has the correct role assigned
      if (existingAdmin.roleId !== adminRole.id) {
        console.log(`Updating user ${adminEmail} to have role '${adminRoleName}'...`);
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { roleId: adminRole.id },
        });
        console.log(`User ${adminEmail} role updated.`);
      }
      return; // Skip creation if user exists
    }

    console.log(`Creating admin user ${adminEmail}...`);
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    // ADDED: Log the actual password variable before hashing
    console.log(`DEBUG: Password variable before hashing: [${adminPassword}]`);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    console.log('Password hashed successfully.');
    
    // ADDED: Log the password source for debugging
    console.log(`DEBUG: Hashing password originating from: ${process.env.DEFAULT_ADMIN_PASSWORD ? 'Environment Variable' : 'Fallback Default'}`);

    // Create the user and assign the Administrator role
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        password: hashedPassword,
        roleId: adminRole.id, // Assign by relation
      },
    });

    console.log(`Admin user created successfully with ID: ${user.id} and assigned role '${adminRoleName}'`);
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
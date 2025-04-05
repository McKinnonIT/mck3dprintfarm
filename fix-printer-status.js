const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPrusaPrinterStatus() {
  try {
    // First show all printers and their status
    console.log('Current printer status:');
    const printers = await prisma.printer.findMany();
    printers.forEach(printer => {
      console.log(`${printer.name}: ${printer.operationalStatus}`);
    });

    // Get the MK4S printer
    const mk4s = printers.find(p => p.name === 'MK4S');
    if (!mk4s) {
      console.log('MK4S printer not found');
      return;
    }

    // Update directly to printing status
    await prisma.printer.update({
      where: { id: mk4s.id },
      data: {
        operationalStatus: 'printing',
        // Don't include printJobName since the schema might not have it yet
      }
    });
    
    console.log('MK4S printer status updated to printing');
    
    // Verify the update
    const updatedPrinter = await prisma.printer.findUnique({
      where: { id: mk4s.id }
    });
    
    console.log(`Updated status: ${updatedPrinter.operationalStatus}`);
  } catch (error) {
    console.error('Error updating printer status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPrusaPrinterStatus(); 
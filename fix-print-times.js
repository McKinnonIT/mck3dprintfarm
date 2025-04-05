const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPrintTimes() {
  try {
    // First show MK4S printer details
    const mk4s = await prisma.printer.findFirst({
      where: { name: 'MK4S' }
    });
    
    if (!mk4s) {
      console.log('MK4S printer not found');
      return;
    }
    
    console.log('Current MK4S printer data:');
    console.log(JSON.stringify(mk4s, null, 2));
    
    // Update print times directly with Number() to ensure numeric values, not strings
    await prisma.printer.update({
      where: { id: mk4s.id },
      data: {
        printTimeElapsed: Number(4892),
        printTimeRemaining: Number(12120),
        printJobName: "question_0.4n_0.2mm_PLA_MK4S_4h41m.bgcode"
      }
    });
    
    console.log('MK4S printer times updated');
    
    // Verify the update
    const updatedPrinter = await prisma.printer.findUnique({
      where: { id: mk4s.id }
    });
    
    console.log('Updated MK4S printer data:');
    console.log(JSON.stringify(updatedPrinter, null, 2));
    
    // Also verify the field types
    console.log('Type of printTimeElapsed:', typeof updatedPrinter.printTimeElapsed);
    console.log('Type of printTimeRemaining:', typeof updatedPrinter.printTimeRemaining);
  } catch (error) {
    console.error('Error updating printer times:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPrintTimes(); 
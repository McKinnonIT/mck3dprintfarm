import { SetupClient } from "./client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function PrusaLinkSetupPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Get the user's PrusaLink printers for diagnostic purposes
  let prusaPrinters = [];
  if (userId) {
    const printers = await prisma.printer.findMany({
      where: {
        OR: [
          { type: { contains: 'prusa' } },
          { type: { contains: 'PRUSA' } }
        ]
      },
      select: {
        id: true,
        name: true,
        type: true,
        apiUrl: true
      }
    });
    prusaPrinters = printers;
  }

  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">PrusaLink Setup</h1>
        <p className="text-muted-foreground">
          Set up required dependencies for working with PrusaLink printers
        </p>
      </div>
      
      <div className="space-y-8">
        <SetupClient />
        
        {prusaPrinters.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Your PrusaLink Printers</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <p className="text-blue-800 mb-2">
                If you're experiencing connection issues with your PrusaLink printers, you can run diagnostic tests 
                to check direct API communication.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {prusaPrinters.map(printer => (
                  <div key={printer.id} className="bg-white border rounded-md p-4">
                    <h3 className="font-medium mb-1">{printer.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{printer.apiUrl}</p>
                    <Link 
                      href={`/dashboard/printers/${printer.id}/prusalink-diagnostic`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Run API Diagnostic →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrinterCard } from "@/components/printers/PrinterCard";
import { InfoCircledIcon } from "@radix-ui/react-icons";

export default async function PrintersPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Please sign in to view this page.</p>
      </div>
    );
  }

  const printers = await prisma.printer.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  // Check if there are Prusa printers
  const hasPrusaPrinters = printers.some(printer => 
    printer.type.toLowerCase().includes('prusa')
  );

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your Printers</h1>
          <p className="text-muted-foreground">
            View and manage your connected 3D printers
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/printers/new">Add Printer</Link>
        </Button>
      </div>

      {hasPrusaPrinters && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <InfoCircledIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                PrusaLink Printers Detected
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  You have PrusaLink printers which require Python and the PrusaLinkPy library.
                  Please make sure these dependencies are installed.
                </p>
                <p className="mt-2">
                  <Link 
                    href="/dashboard/prusalink-setup" 
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Check PrusaLink Setup →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {printers.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            You haven&apos;t added any printers yet.
          </p>
          <Button asChild>
            <Link href="/dashboard/printers/new">Add Your First Printer</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {printers.map((printer) => (
            <PrinterCard key={printer.id} printer={printer} />
          ))}
        </div>
      )}
    </div>
  );
} 
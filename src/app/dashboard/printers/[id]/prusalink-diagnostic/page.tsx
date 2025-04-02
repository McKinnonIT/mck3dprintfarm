import { PrusaLinkDiagnostic } from "@/components/printers/PrusaLinkDiagnostic";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function PrusaLinkDiagnosticPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Please sign in to view this page.</p>
      </div>
    );
  }

  const printer = await prisma.printer.findUnique({
    where: {
      id: params.id,
    },
  });

  if (!printer) {
    notFound();
  }

  // Make sure this is a PrusaLink printer
  if (!printer.type.toLowerCase().includes('prusa')) {
    return (
      <div className="container py-10">
        <div className="mb-6">
          <Link href="/dashboard/printers" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to printers
          </Link>
          <h1 className="text-2xl font-bold">Printer Diagnostic</h1>
        </div>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-4">
          <p>This diagnostic tool is only for PrusaLink printers. {printer.name} is a {printer.type} printer.</p>
          <Link href="/dashboard/printers" className="text-amber-600 font-medium hover:text-amber-800 mt-2 inline-block">
            Go back to printers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-6">
        <Link href="/dashboard/printers" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to printers
        </Link>
        <h1 className="text-2xl font-bold">{printer.name} Diagnostic</h1>
        <p className="text-muted-foreground">
          Run diagnostic tests for your PrusaLink printer
        </p>
      </div>
      <PrusaLinkDiagnostic printerId={printer.id} printerName={printer.name} />
    </div>
  );
} 
"use client";

import { PrusaLinkDiagnostic } from "@/components/printers/PrusaLinkDiagnostic";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink() {
  return (
    <Link href="/dashboard/printers" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
      <ArrowLeft className="mr-1 h-4 w-4" />
      Back to printers
    </Link>
  );
}

export function DiagnosticClient({ printerId, printerName }: { printerId: string; printerName: string }) {
  return <PrusaLinkDiagnostic printerId={printerId} printerName={printerName} />;
} 
"use client";

import { PrusaLinkDiagnostic } from "@/components/printers/PrusaLinkDiagnostic";

export function DiagnosticClient({ printerId, printerName }: { printerId: string; printerName: string }) {
  return <PrusaLinkDiagnostic printerId={printerId} printerName={printerName} />;
} 
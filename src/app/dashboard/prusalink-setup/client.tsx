"use client";

import { PrusaLinkSetup } from "@/components/printers/PrusaLinkSetup";
import { useToast } from "@/components/ui/use-toast";

export function SetupClient() {
  // This is a wrapper component that ensures all client-side dependencies
  // are properly loaded in a client component context
  return <PrusaLinkSetup />;
} 
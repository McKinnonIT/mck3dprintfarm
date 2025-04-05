"use client";

import { PrusaLinkSetup } from "@/components/printers/PrusaLinkSetup";

export function SetupClient() {
  // This is a wrapper component that ensures all client-side dependencies
  // are properly loaded in a client component context
  return <PrusaLinkSetup />;
} 
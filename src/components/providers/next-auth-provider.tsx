"use client";

import { SessionProvider } from "next-auth/react";

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      // Disable automatic session refetching to potentially reduce re-renders
      refetchInterval={0} 
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
} 
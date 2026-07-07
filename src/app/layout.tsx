// Remove "use client" directive since we need to export metadata
// We'll avoid using next/font for now to prevent SWC/Babel conflicts

import { NextAuthProvider } from "@/components/providers/next-auth-provider";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
// import prisma from "../lib/prisma"; // No longer needed here
// import type { Metadata } from 'next'; // No longer needed here
import DocumentTitleUpdater from "@/components/document-title-updater";
import { ThemeProvider, THEME_BOOT_SCRIPT } from "@/components/theme-provider";
import "./globals.css";

// Removed generateMetadata function

export default function RootLayout({ // No longer async
  children,
}: {
  children: React.ReactNode;
}) {

  // Removed title fetching logic

  return (
    // suppressHydrationWarning: the boot script below sets the dim/dark
    // class on this element before React hydrates, which would otherwise
    // trip React's server/client mismatch warning for a difference it's
    // intentionally not responsible for.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint so a returning dim/dark user never sees a
            flash of the light theme - must read the same storage key/class
            names as ThemeProvider (theme-provider.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans">
         {/* Render the client component - it fetches its own data */}
         <DocumentTitleUpdater />
        <ThemeProvider>
          <NextAuthProvider>
            <div className="min-h-screen bg-background flex flex-col">
              {/* Pass title to Navigation? (Optional cleanup later) */}
              <Navigation />
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
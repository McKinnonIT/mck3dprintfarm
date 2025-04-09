// Remove "use client" directive since we need to export metadata
// We'll avoid using next/font for now to prevent SWC/Babel conflicts

import { NextAuthProvider } from "@/components/providers/next-auth-provider";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
// import prisma from "../lib/prisma"; // No longer needed here
// import type { Metadata } from 'next'; // No longer needed here
import DocumentTitleUpdater from "@/components/document-title-updater";
import "./globals.css";

// Removed generateMetadata function

export default function RootLayout({ // No longer async
  children,
}: {
  children: React.ReactNode;
}) {

  // Removed title fetching logic

  return (
    <html lang="en">
      <head>
        {/* Metadata tags can still go here if needed, but title is handled below */}
      </head>
      <body className="font-sans">
         {/* Render the client component - it fetches its own data */}
         <DocumentTitleUpdater />
        <NextAuthProvider>
          <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Pass title to Navigation? (Optional cleanup later) */}
            <Navigation />
            <main className="flex-grow">{children}</main>
            <Footer />
          </div>
        </NextAuthProvider>
      </body>
    </html>
  );
} 
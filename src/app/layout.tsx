// Remove "use client" directive since we need to export metadata
// We'll avoid using next/font for now to prevent SWC/Babel conflicts

import { NextAuthProvider } from "@/components/providers/next-auth-provider";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata = {
  title: "3D Print Farm",
  description: "Manage your 3D printers and print jobs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <NextAuthProvider>
          <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navigation />
            <main className="flex-grow">{children}</main>
            <Footer />
          </div>
        </NextAuthProvider>
      </body>
    </html>
  );
} 
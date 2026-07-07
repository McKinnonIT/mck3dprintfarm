"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { BellIcon, CogIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

// Helper function to check page access
const canAccessPage = (allowedPages: string[] | undefined | null, pagePath: string): boolean => {
    if (!allowedPages) {
        console.log(`canAccessPage: No allowedPages array provided for path ${pagePath}. Denying access.`);
        return false; 
    }
    
    // Explicitly check for wildcard access
    if (allowedPages.includes('*')) {
        console.log(`canAccessPage check for ${pagePath}: GRANTED (Wildcard access). Allowed:`, allowedPages);
        return true;
    }

    // Original check for exact match or parent path match
    const hasAccess = allowedPages.some(allowedPath => 
        pagePath === allowedPath || pagePath.startsWith(allowedPath + '/')
    );
    console.log(`canAccessPage check for ${pagePath}: ${hasAccess ? 'GRANTED' : 'DENIED'}. Allowed:`, allowedPages);
    return hasAccess;
};

export function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const allowedPages = session?.user?.allowedPages;
  const [printFarmTitle, setPrintFarmTitle] = useState<string | null>(null);

  // Log session data for debugging
  useEffect(() => {
    if (session) {
      console.log("Navigation Session Check:", JSON.stringify(session, null, 2));
    }
  }, [session]);

  useEffect(() => {
    // Fetch settings when component mounts
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      console.log("Navigation: Fetching settings...");
      const response = await fetch("/api/settings");
      if (!response.ok) {
         // Handle non-OK responses (like 401/403 if auth is added later)
         console.error(`Navigation: Failed to fetch settings - Status ${response.status}`);
         throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      console.log("Navigation: Settings fetched:", data);
      // Set title from fetched data, fallback to empty string if needed
      setPrintFarmTitle(data.printFarmTitle || "Farm Title Missing"); 
    } catch (error) {
      console.error("Navigation: Error fetching print farm title:", error);
      setPrintFarmTitle("Error Loading Title"); // Indicate error in UI
    }
  };

  // Use cn for active class calculation
  const getLinkClassName = (path: string) => {
    const isActive = pathname === path || (path !== '/' && pathname.startsWith(path + '/')); // Handle subpaths
    return cn(
        'rounded-md px-3 py-2 text-sm font-medium',
        isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );
  };

  const getIconLinkClassName = (path: string) => {
     const isActive = pathname === path || (path !== '/' && pathname.startsWith(path + '/')); // Handle subpaths
     return cn(
        'rounded-md p-2',
         isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
     );
  };

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <span className="text-xl font-bold text-foreground">
              {printFarmTitle === null ? "Loading..." : printFarmTitle}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Dashboard Link - public, no access check */}
            <Link href="/dashboard" className={getLinkClassName('/dashboard')}>
                Dashboard
            </Link>

            {/* Jobs Link */} 
            {session && canAccessPage(allowedPages, '/jobs') && (
                <Link href="/jobs" className={getLinkClassName('/jobs')}>
                    Jobs
                </Link>
            )}

            {/* Other Links - only render if user is logged in */}
            {session && (
              <>
                {/* Printers Link */} 
                {canAccessPage(allowedPages, '/printers') && (
                    <Link href="/printers" className={getLinkClassName('/printers')}>
                        Printers
                    </Link>
                )}
                {/* Groups Link */} 
                {canAccessPage(allowedPages, '/groups') && (
                    <Link href="/groups" className={getLinkClassName('/groups')}>
                        Groups
                    </Link>
                )}
                {/* Slicer Link */} 
                {canAccessPage(allowedPages, '/slicer') && (
                    <Link href="/slicer" className={getLinkClassName('/slicer')}>
                        Slicer
                    </Link>
                )}
                {/* Files Link */} 
                {canAccessPage(allowedPages, '/files') && (
                    <Link href="/files" className={getLinkClassName('/files')}>
                        Files
                    </Link>
                )}
              </>
            )}

            {/* Appearance toggle - always available regardless of session */}
            <ThemeToggle />

            {/* Icons and Sign Out/In - only render if user is logged in */}
            {session && (
              <>
                {/* Notifications Icon (always shown for logged-in users?) */}
                <Link href="#" className={getIconLinkClassName('#')} title="Notifications">
                  <BellIcon className="h-5 w-5" />
                </Link>

                {/* Settings Icon Link */}
                {canAccessPage(allowedPages, '/settings') && (
                    <Link href="/settings" className={getIconLinkClassName('/settings')} title="Settings">
                        <CogIcon className="h-5 w-5" />
                    </Link>
                )}
              </>
            )}

            {/* Sign Out / Sign In Button */} 
            {session ? (
              <Link
                href="/api/auth/signout"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-destructive-foreground bg-destructive hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-destructive"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                Sign Out
              </Link>
            ) : (
               <Link
                 href="/auth/signin" // Link to sign-in page if not authenticated
                 className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
               >
                 <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                 Sign In
               </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import packageInfo from '../../package.json';

// Read version from package.json
const APP_VERSION = packageInfo.version;
const VERSION_ANCHOR = 'v' + APP_VERSION; // for anchor links in changelog

export function Footer() {
  // Initialize state as null (loading)
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    // Fetch settings when component mounts
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      console.log("Footer: Fetching settings...");
      const response = await fetch("/api/settings"); // Assumes this returns { organizationName: "..." }
      if (!response.ok) {
         console.error(`Footer: Failed to fetch settings - Status ${response.status}`);
         throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      console.log("Footer: Settings fetched:", data);
      // Set name from fetched data, fallback to default if needed
      setOrganizationName(data.organizationName || "Default Org Name"); 
    } catch (error) {
      console.error("Footer: Error fetching organization name:", error);
      setOrganizationName("Error Loading Org"); // Indicate error in UI
    }
  };

  return (
    <footer className="w-full py-4 mt-10 border-t">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <div>
            {/* Display name or loading/error state */}
            &copy; {currentYear} {organizationName === null ? "Loading..." : organizationName}. All rights reserved.
          </div>
          <div className="mt-2 md:mt-0 flex space-x-4">
            <Link href={`/changelog#${VERSION_ANCHOR}`} className="hover:text-blue-600">
              Version {APP_VERSION}
            </Link>
            <Link href="/about" className="hover:text-blue-600">
              About
            </Link>
            <Link href="/privacy" className="hover:text-blue-600">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
} 
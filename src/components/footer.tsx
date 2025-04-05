"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import packageInfo from '../../package.json';

// Read version from package.json
const APP_VERSION = packageInfo.version;
const VERSION_ANCHOR = 'v' + APP_VERSION; // for anchor links in changelog

export function Footer() {
  const [organizationName, setOrganizationName] = useState("McKelvey Engineering");
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    // Fetch settings when component mounts
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.organizationName) {
          setOrganizationName(data.organizationName);
        }
      }
    } catch (error) {
      console.error("Error fetching organization name:", error);
    }
  };

  return (
    <footer className="w-full py-4 mt-10 border-t">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
          <div>
            &copy; {currentYear} {organizationName}. All rights reserved.
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
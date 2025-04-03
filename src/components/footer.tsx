import React from 'react';
import Link from 'next/link';

// App version - update this when making significant changes
const APP_VERSION = '0.0.2a';
const VERSION_ANCHOR = 'v' + APP_VERSION; // for anchor links in changelog

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full py-4 mt-10 border-t">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
          <div>
            &copy; {currentYear} McKinnon Secondary College. All rights reserved.
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
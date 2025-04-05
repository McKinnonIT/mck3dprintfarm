"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { BellIcon, CogIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

export function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [printFarmTitle, setPrintFarmTitle] = useState("McKinnon 3D Print Farm");

  useEffect(() => {
    // Fetch settings when component mounts
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.printFarmTitle) {
          setPrintFarmTitle(data.printFarmTitle);
        }
      }
    } catch (error) {
      console.error("Error fetching print farm title:", error);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <span className="text-xl font-bold text-gray-900">
              {printFarmTitle}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                isActive("/")
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Dashboard
            </Link>
            {session && (
              <>
                <Link
                  href="/printers"
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isActive("/printers")
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  Printers
                </Link>
                <Link
                  href="/groups"
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isActive("/groups")
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  Groups
                </Link>
                <Link
                  href="/slicer"
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isActive("/slicer")
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  Slicer
                </Link>
                <Link
                  href="/files"
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isActive("/files")
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  Files
                </Link>
              </>
            )}
            {session && (
              <>
                <Link 
                  href="#" 
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  title="Notifications"
                >
                  <BellIcon className="h-5 w-5" />
                </Link>
                
                <Link 
                  href="/settings" 
                  className={`rounded-md p-2 ${
                    isActive("/settings")
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  title="Settings"
                >
                  <CogIcon className="h-5 w-5" />
                </Link>
              </>
            )}
            {session ? (
              <Link
                href="/api/auth/signout"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                Sign Out
              </Link>
            ) : (
              <Link
                href="/auth/signin"
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
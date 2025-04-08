"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { canAccessPage } from "@/lib/rbacUtils"; // Assuming rbac utils are in /lib/rbacUtils

// Define a simple loading component or message
function LoadingScreen() {
  return <div className="flex justify-center items-center h-screen">Loading...</div>;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Don't do anything while loading the session
    if (status === 'loading') {
      return;
    }

    // If unauthenticated, redirect to signin page
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }

    // If authenticated, check access and redirect
    if (status === 'authenticated') {
      const allowedPages = session?.user?.allowedPages;
      // Check access specifically for '/dashboard' identifier
      const hasAccessToDashboard = canAccessPage(allowedPages, '/dashboard');

      if (hasAccessToDashboard) {
        router.replace('/dashboard');
      } else {
        // User is authenticated but doesn't have access to the dashboard
        // Redirect to access denied page or a default permitted page if applicable
        console.log("HomePage: Access to /dashboard denied, redirecting to /access-denied...");
        router.replace('/access-denied'); 
      }
    }
  }, [status, session, router]);

  // Render a loading indicator while checking session and redirecting
  return <LoadingScreen />;
} 
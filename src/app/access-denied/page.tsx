'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-md">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500" />
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Access Denied</h1>
        <p className="mt-2 text-gray-600">
          You do not have permission to access the requested page.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          If you believe this is an error, please contact your administrator.
        </p>
        <div className="mt-6">
          <Link href="/dashboard" passHref>
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 
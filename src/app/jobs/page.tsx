"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // For displaying status
import { formatDistanceToNow } from 'date-fns';
import { canAccessPage } from "@/lib/rbacUtils";

// Define Job type matching API response
type Job = {
  id: string;
  name: string;
  status: string; // From JobStatus enum
  submittedAt: string;
  submittedByUser: { name: string | null; email: string; };
  printer: { name: string; };
  file: { name: string; };
  // Add other fields as needed from the API response
};

type ApiResponse = {
  jobs: Job[];
  totalJobs: number;
  currentPage: number;
  totalPages: number;
};

const JOBS_PER_PAGE = 20;

export default function JobsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const allowedPages = session?.user?.allowedPages;
  const hasAccess = canAccessPage(allowedPages, '/jobs');

  const [activeTab, setActiveTab] = useState<string>("printing");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Map tab values to API status filters
  const statusMap: { [key: string]: string } = {
    printing: "PRINTING",
    approved: "APPROVED,QUEUED", // Combine approved and queued as discussed
    queued: "PENDING_APPROVAL",
    all: "", // No status filter for all jobs
  };

  const fetchJobs = useCallback(async (tab: string, page: number) => {
    if (sessionStatus !== 'authenticated' || !hasAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const statusFilter = statusMap[tab] || "";
    const url = `/api/jobs?page=${page}&limit=${JOBS_PER_PAGE}${statusFilter ? `&status=${statusFilter}` : ''}`;

    try {
      console.log(`[JobsPage] Fetching jobs for tab '${tab}', page ${page}: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch jobs');
      }
      const data: ApiResponse = await response.json();
      console.log(`[JobsPage] Received data:`, data);
      setJobs(data.jobs || []);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (err) {
      console.error("Fetch jobs error:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setJobs([]);
      setTotalPages(1);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, [sessionStatus, hasAccess]); // Dependencies for the fetch function

  // Fetch jobs when tab or page changes
  useEffect(() => {
    fetchJobs(activeTab, currentPage);
  }, [activeTab, currentPage, fetchJobs]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCurrentPage(1); // Reset to first page when changing tabs
  };

  // Handle pagination
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  // Access control check
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus === 'unauthenticated') {
      router.replace('/auth/signin');
    } else if (!hasAccess) {
      router.replace('/access-denied');
    }
  }, [sessionStatus, hasAccess, router]);

  // Loading state
  if (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && loading)) {
      return <div className="p-6">Loading jobs...</div>;
  }

  // Helper to format status badges (customize colors later)
  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'PRINTING': return 'default';
      case 'COMPLETED': return 'secondary';
      case 'FAILED':
      case 'CANCELLED': return 'destructive';
      case 'PENDING_APPROVAL':
      case 'APPROVED':
      case 'QUEUED': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Print Jobs</h2>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4"> {/* Adjusted for 4 tabs */}
          <TabsTrigger value="printing">Printing</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="queued">Pending Approval</TabsTrigger> {/* Renamed label */}
          <TabsTrigger value="all">All Jobs</TabsTrigger>
        </TabsList>

        {/* Define content for each tab */}
        {Object.keys(statusMap).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="space-y-4">
            {error && (
              <div className="text-red-600">Error loading jobs: {error}</div>
            )}
            {!error && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Printer</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead> {/* Placeholder */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No jobs found for this status.
                        </TableCell>
                      </TableRow>
                    )}
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.file?.name || job.name}</TableCell>
                        <TableCell>{job.printer?.name || 'N/A'}</TableCell>
                        <TableCell>{job.submittedByUser?.name || job.submittedByUser?.email || 'N/A'}</TableCell>
                        <TableCell>{formatDistanceToNow(new Date(job.submittedAt), { addSuffix: true })}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(job.status)}>{job.status.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          {/* Placeholder for action buttons like Approve, Cancel */}
                          <Button variant="outline" size="sm" disabled>Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
} 
"use client";

import React, { useState, useEffect } from "react";

type PrintJob = {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  file: {
    name: string;
  };
};

type PrintJobHistoryProps = {
  printerId: string;
  printerType: string;
  apiUrl: string;
  apiKey?: string;
};

export function PrintJobHistory({ printerId, printerType, apiUrl, apiKey }: PrintJobHistoryProps) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJobHistory = async () => {
    try {
      setIsLoading(true);
      setError("");

      if (printerType === "moonraker") {
        const response = await fetch(`${apiUrl}/server/history/list?limit=10`);
        if (!response.ok) throw new Error("Failed to fetch job history");
        const data = await response.json();
        
        setJobs(data.result.jobs.map((job: any) => ({
          id: job.job_id,
          name: job.filename,
          status: job.status,
          startTime: new Date(job.start_time * 1000),
          endTime: job.end_time ? new Date(job.end_time * 1000) : undefined,
          duration: job.print_duration,
          file: {
            name: job.filename,
          },
        })));
      } else if (printerType === "prusalink") {
        const response = await fetch(`${apiUrl}/api/jobs`, {
          headers: {
            'X-Api-Key': apiKey || ''
          }
        });
        if (!response.ok) throw new Error("Failed to fetch job history");
        const data = await response.json();
        
        setJobs(data.jobs.map((job: any) => ({
          id: job.id,
          name: job.name,
          status: job.state,
          startTime: new Date(job.start_time),
          endTime: job.end_time ? new Date(job.end_time) : undefined,
          duration: job.print_time,
          file: {
            name: job.name,
          },
        })));
      }
    } catch (err) {
      setError("Failed to load print job history");
      console.error("Error fetching job history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobHistory();
  }, [printerId, printerType, apiUrl, apiKey]);

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return "";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading job history...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-600">{error}</div>;
  }

  if (jobs.length === 0) {
    return <div className="text-center py-4 text-gray-600">No print jobs found</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Recent Print Jobs</h3>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="rounded-lg border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{job.file.name}</h4>
                <p className="text-sm text-gray-600">
                  Started: {job.startTime.toLocaleString()}
                </p>
                {job.endTime && (
                  <p className="text-sm text-gray-600">
                    Ended: {job.endTime.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    job.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : job.status === "printing"
                      ? "bg-blue-100 text-blue-800"
                      : job.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {job.status}
                </span>
                {job.duration && (
                  <p className="text-sm text-gray-600 mt-1">
                    Duration: {formatDuration(job.duration)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 
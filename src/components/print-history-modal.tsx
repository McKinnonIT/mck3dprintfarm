import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area"; // Use ScrollArea for long lists
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Use Table for structured display

// Use the same type as defined in the API route
type JobHistoryEntry = {
  timestamp: number | string;
  filename: string;
  duration?: number;
  status: 'completed' | 'failed' | 'cancelled' | 'unknown';
  // Add other relevant fields if needed
};

interface PrintHistoryModalProps {
  printerName: string;
  history: JobHistoryEntry[] | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to format duration (similar to dashboard)
const formatDuration = (seconds: number | undefined | null) => {
  if (seconds === null || seconds === undefined || seconds <= 0) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

// Helper to format timestamp
const formatTimestamp = (ts: number | string) => {
  try {
    const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000); // Handle string or seconds timestamp
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString();
  } catch {
    return "Invalid Date";
  }
};

export const PrintHistoryModal: React.FC<PrintHistoryModalProps> = ({
  printerName,
  history,
  isLoading,
  error,
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]"> {/* Wider modal */}
        <DialogHeader>
          <DialogTitle>Print History: {printerName}</DialogTitle>
          <DialogDescription>
            Recent print jobs recorded by the printer.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <p>Loading history...</p>
          ) : error ? (
            <p className="text-red-600">Error loading history: {error}</p>
          ) : !history || history.length === 0 ? (
            <p>No print history available.</p>
          ) : (
            <ScrollArea className="h-[400px]"> {/* Make history scrollable */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((job, index) => (
                    <TableRow key={index}> {/* Use index if no unique ID from API */}
                      <TableCell>{formatTimestamp(job.timestamp)}</TableCell>
                      <TableCell className="truncate max-w-[300px]" title={job.filename}>{job.filename}</TableCell>
                      <TableCell>{formatDuration(job.duration)}</TableCell>
                      <TableCell>{job.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 
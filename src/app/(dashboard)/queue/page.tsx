"use client";

import React from "react";

const mockQueue = [
  {
    id: "1",
    name: "Benchy.gcode",
    status: "pending",
    user: "Admin",
    createdAt: new Date(),
  },
  {
    id: "2",
    name: "Calibration_cube.gcode",
    status: "printing",
    user: "Admin",
    createdAt: new Date(),
  },
];

export default function QueuePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold">Print Queue</h1>
      
      {mockQueue.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-600">No print jobs in queue.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mockQueue.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{job.name}</h2>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    job.status === "printing"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Added by: {job.user}
              </p>
              <p className="text-sm text-gray-600">
                Added: {job.createdAt.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
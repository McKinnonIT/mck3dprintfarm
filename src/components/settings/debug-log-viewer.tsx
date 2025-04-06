"use client";

import React, { useState, useEffect, useRef } from 'react';

export default function DebugLogViewer() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Function to connect to the SSE endpoint
    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      console.log("Connecting to /api/debug/logs...");
      setError(null);
      setLogs(["Attempting to connect to log stream..."]); // Initial log message
      
      const eventSource = new EventSource("/api/debug/logs");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("SSE Connection opened");
        setLogs(prev => [...prev, "--- Log stream connected ---"]);
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        // Append new log lines
        setLogs(prev => [...prev, ...event.data.split('\n')]);
      };
      
      eventSource.addEventListener('error', (event: MessageEvent) => {
         console.error("SSE Error Event:", event);
         let errorMessage = "An unknown error occurred with the log stream.";
         if (event.data) {
            try {
               const parsedError = JSON.parse(event.data);
               errorMessage = parsedError.message || event.data;
            } catch (e) {
               errorMessage = event.data;
            }
         }
         setLogs(prev => [...prev, `--- SSE Error: ${errorMessage} ---`]);
         setError(`Failed to connect or stream logs: ${errorMessage}`);
         setIsConnected(false);
         eventSource.close(); // Close on explicit error event
      });

      eventSource.onerror = (err) => {
        // This handles general network errors or connection closure
        console.error("SSE connection error:", err);
        if (eventSource.readyState === EventSource.CLOSED) {
          setLogs(prev => [...prev, "--- Log stream connection closed by server or network error ---"]);
        } else {
          setLogs(prev => [...prev, "--- An error occurred with the log stream connection ---"]);
        }
        setError("Connection to log stream failed or was closed.");
        setIsConnected(false);
        eventSource.close(); // Ensure closure
      };
      
      eventSource.addEventListener('close', (event: MessageEvent) => {
         console.log("SSE close event received", event.data);
         setLogs(prev => [...prev, `--- Log stream closed by server: ${event.data} ---`]);
         setIsConnected(false);
         eventSource.close(); // Ensure closure
      });
    };

    connect();

    // Cleanup function to close the connection when the component unmounts
    return () => {
      console.log("Closing SSE connection...");
      eventSourceRef.current?.close();
      setIsConnected(false);
    };
  }, []); // Empty dependency array means this runs once on mount

  // Scroll to the bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">
          Live Docker Container Logs (docker-tests-mck3dprintfarm-1)
        </h3>
        <span className={`px-2 py-1 text-xs font-semibold rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">
          {error}
        </div>
      )}
      <div 
        className="bg-gray-900 text-gray-200 font-mono text-xs p-4 rounded-md overflow-y-scroll h-96 border border-gray-700"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} // Ensure wrapping
      >
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
        <div ref={logsEndRef} /> {/* Invisible element to scroll to */}
      </div>
    </div>
  );
} 
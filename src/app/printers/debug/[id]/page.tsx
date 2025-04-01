"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey?: string;
  status: string;
  operationalStatus: string;
  lastSeen: string;
  printStartTime?: string;
  printTimeElapsed?: number;
  printTimeRemaining?: number;
  groupId?: string;
  webcamUrl?: string;
  printImageUrl?: string;
  bedTemp?: number;
  toolTemp?: number;
};

export default function PrinterDebugPage() {
  const params = useParams();
  const router = useRouter();
  const [printer, setPrinter] = useState<Printer | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [manualTimeElapsed, setManualTimeElapsed] = useState<string>("");
  const [manualTimeRemaining, setManualTimeRemaining] = useState<string>("");
  const [updateMessage, setUpdateMessage] = useState<string>("");
  
  useEffect(() => {
    fetchPrinter();
  }, []);
  
  const fetchPrinter = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/printers/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setPrinter(data);
        if (data.printTimeElapsed) {
          setManualTimeElapsed(data.printTimeElapsed.toString());
        }
        if (data.printTimeRemaining) {
          setManualTimeRemaining(data.printTimeRemaining.toString());
        }
      } else {
        console.error('Failed to fetch printer');
      }
    } catch (error) {
      console.error('Error fetching printer:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const runTest = async () => {
    if (!printer) return;
    
    try {
      setUpdating(true);
      // Use appropriate test endpoint based on printer type
      const endpoint = printer.type === "prusalink" 
        ? `/api/test-prusalink-status?printerId=${printer.id}`
        : `/api/test-moonraker-status/${printer.id}`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      console.error('Error running test:', error);
    } finally {
      setUpdating(false);
    }
  };
  
  const updateStatus = async () => {
    try {
      setUpdating(true);
      const response = await fetch('/api/printers/status');
      if (response.ok) {
        setUpdateMessage("Status updated successfully");
        fetchPrinter();
      } else {
        setUpdateMessage("Failed to update status");
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setUpdateMessage("Error updating status");
    } finally {
      setUpdating(false);
    }
  };
  
  const updateManualTimes = async () => {
    if (!printer) return;
    
    try {
      setUpdating(true);
      
      const updateData = {
        printTimeElapsed: manualTimeElapsed ? parseFloat(manualTimeElapsed) : undefined,
        printTimeRemaining: manualTimeRemaining ? parseFloat(manualTimeRemaining) : undefined,
      };
      
      const response = await fetch(`/api/printers/${printer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (response.ok) {
        setUpdateMessage("Times updated successfully");
        fetchPrinter();
      } else {
        setUpdateMessage("Failed to update times");
      }
    } catch (error) {
      console.error('Error updating times:', error);
      setUpdateMessage("Error updating times");
    } finally {
      setUpdating(false);
    }
  };
  
  const formatTime = (seconds?: number): string => {
    if (!seconds) return "N/A";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Loading printer information...</h1>
      </div>
    );
  }
  
  if (!printer) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Printer not found</h1>
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-4 flex gap-2 items-center">
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          Dashboard
        </Link>
        <span className="text-gray-500">/</span>
        <Link href="/printers" className="text-blue-600 hover:underline">
          Manage Printers
        </Link>
        <span className="text-gray-500">/</span>
        <span className="text-gray-700">Debug {printer.name}</span>
      </div>
      
      <h1 className="text-2xl font-bold mb-4">Printer Debug: {printer.name}</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Printer Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p><strong>ID:</strong> {printer.id}</p>
            <p><strong>Name:</strong> {printer.name}</p>
            <p><strong>Type:</strong> {printer.type}</p>
            <p><strong>API URL:</strong> {printer.apiUrl}</p>
            <p><strong>Status:</strong> {printer.status}</p>
            <p><strong>Operational Status:</strong> {printer.operationalStatus}</p>
          </div>
          <div>
            <p><strong>Last Seen:</strong> {new Date(printer.lastSeen).toLocaleString()}</p>
            <p><strong>Print Start Time:</strong> {printer.printStartTime ? new Date(printer.printStartTime).toLocaleString() : 'N/A'}</p>
            <p><strong>Print Time Elapsed:</strong> {formatTime(printer.printTimeElapsed)}</p>
            <p><strong>Print Time Remaining:</strong> {formatTime(printer.printTimeRemaining)}</p>
            <p><strong>Bed Temperature:</strong> {printer.bedTemp !== null ? `${printer.bedTemp}°C` : 'N/A'}</p>
            <p><strong>Tool Temperature:</strong> {printer.toolTemp !== null ? `${printer.toolTemp}°C` : 'N/A'}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={updateStatus}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
            disabled={updating}
          >
            {updating ? 'Updating...' : 'Update Status Now'}
          </button>
          
          <button 
            onClick={runTest}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mr-2"
            disabled={updating}
          >
            {updating ? 'Testing...' : `Test ${printer.type === "prusalink" ? "PrusaLink" : "Moonraker"} Status`}
          </button>
          
          {printer.type === 'prusalink' && (
            <>
              <a 
                href={`/api/test-job-times/${printer.id}`}
                target="_blank" 
                className="inline-flex items-center justify-center bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mr-2"
              >
                Test Job Times
              </a>
              
              <a 
                href={`/api/printers/raw-job-data/${printer.id}`}
                target="_blank" 
                className="inline-flex items-center justify-center bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
              >
                Raw API Data
              </a>
            </>
          )}
          
          {printer.type === 'moonraker' && (
            <>
              <a 
                href={`/api/test-moonraker-status/${printer.id}`}
                target="_blank" 
                className="inline-flex items-center justify-center bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mr-2"
              >
                Test Status API
              </a>
              
              <a 
                href={`/api/printers/raw-moonraker-data/${printer.id}`}
                target="_blank" 
                className="inline-flex items-center justify-center bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
              >
                Raw API Data
              </a>
            </>
          )}
        </div>
        
        {updateMessage && (
          <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded">
            {updateMessage}
          </div>
        )}
      </div>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Manual Time Update</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2">
              Time Elapsed (seconds):
              <input 
                type="number"
                value={manualTimeElapsed}
                onChange={(e) => setManualTimeElapsed(e.target.value)}
                className="w-full border rounded p-2 mt-1"
              />
            </label>
          </div>
          <div>
            <label className="block mb-2">
              Time Remaining (seconds):
              <input 
                type="number"
                value={manualTimeRemaining}
                onChange={(e) => setManualTimeRemaining(e.target.value)}
                className="w-full border rounded p-2 mt-1"
              />
            </label>
          </div>
        </div>
        
        <button 
          onClick={updateManualTimes}
          className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
          disabled={updating}
        >
          {updating ? 'Updating...' : 'Apply Manual Times'}
        </button>
      </div>
      
      {testResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          
          <div className="mb-4">
            <h3 className="font-semibold">Status:</h3>
            <div className={`p-3 rounded ${testResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
              {testResult.success ? 'Success' : 'Failed'}: {testResult.message}
            </div>
          </div>
          
          {testResult.data?.status && printer.type === "prusalink" && (
            <div className="mb-4">
              <h3 className="font-semibold">Print Status:</h3>
              <div className="bg-gray-100 p-3 rounded overflow-auto">
                <p><strong>Printing:</strong> {testResult.data.status.is_printing ? 'Yes' : 'No'}</p>
                <p><strong>Progress:</strong> {Math.round(testResult.data.status.progress * 100)}%</p>
                <p><strong>Time Elapsed:</strong> {formatTime(testResult.data.status.print_time_elapsed)}</p>
                <p><strong>Time Remaining:</strong> {formatTime(testResult.data.status.print_time_remaining)}</p>
                <p><strong>Start Time:</strong> {testResult.data.status.print_start_time ? new Date(testResult.data.status.print_start_time * 1000).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          )}
          
          {testResult.status && printer.type === "moonraker" && (
            <div className="mb-4">
              <h3 className="font-semibold">Print Status:</h3>
              <div className="bg-gray-100 p-3 rounded overflow-auto">
                <p><strong>State:</strong> {testResult.status.state || 'N/A'}</p>
                <p><strong>Progress:</strong> {testResult.status.progress !== undefined ? `${Math.round(testResult.status.progress)}%` : 'N/A'}</p>
                <p><strong>Time Elapsed:</strong> {formatTime(testResult.status.print_time_elapsed)}</p>
                <p><strong>Time Remaining:</strong> {formatTime(testResult.status.print_time_remaining)}</p>
                <p><strong>Bed Temperature:</strong> {testResult.status.bed_temp !== undefined ? `${testResult.status.bed_temp.toFixed(1)}°C` : 'N/A'}</p>
                <p><strong>Tool Temperature:</strong> {testResult.status.tool_temp !== undefined ? `${testResult.status.tool_temp.toFixed(1)}°C` : 'N/A'}</p>
              </div>
            </div>
          )}
          
          <div className="mb-4">
            <h3 className="font-semibold">Raw Response:</h3>
            <div className="bg-gray-100 p-3 rounded overflow-auto">
              <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
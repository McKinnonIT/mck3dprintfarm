"use client";

import React, { useState } from "react";

export default function PrusaLinkDebugPage() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTest = async () => {
    if (!apiUrl) {
      setError("API URL is required");
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/debug-prusalink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiUrl,
          apiKey: apiKey || undefined,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error("Error testing PrusaLink:", err);
      setError("Failed to test connection. Please check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">PrusaLink Connection Debugger</h1>
      
      <div className="mb-8 p-6 bg-white rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Connection Details</h2>
        <div className="mb-4">
          <label htmlFor="apiUrl" className="block text-sm font-medium mb-1">
            API URL
          </label>
          <input
            id="apiUrl"
            className="w-full p-2 border rounded"
            placeholder="e.g., http://192.168.1.100"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
          <p className="text-sm text-gray-500 mt-1">
            Must include http:// or https://
          </p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
            API Key
          </label>
          <input
            id="apiKey"
            className="w-full p-2 border rounded"
            placeholder="Your API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 mb-4">
            {error}
          </div>
        )}
        
        <button 
          onClick={handleTest} 
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Testing Connection..." : "Test Connection"}
        </button>
      </div>
      
      {result && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Connection Results</h2>
          
          <div className="mb-4">
            <h3 className="font-medium">API URL Tested</h3>
            <p className="text-sm">{result.apiUrl}</p>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium">Overall Status</h3>
            <p className={`font-medium ${result.allFailed ? 'text-red-600' : 'text-green-600'}`}>
              {result.message}
            </p>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Endpoint Results</h3>
            <div className="space-y-3">
              {result.results.map((endpointResult: any, index: number) => (
                <div 
                  key={index} 
                  className={`border rounded-md p-3 ${
                    endpointResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <p className="font-medium">{endpointResult.endpoint}</p>
                  {endpointResult.success ? (
                    <div>
                      <p className="text-green-600 text-sm">Success (Status: {endpointResult.status})</p>
                      <details>
                        <summary className="text-sm cursor-pointer mt-1">View Response Data</summary>
                        <pre className="text-xs mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(endpointResult.data, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : (
                    <p className="text-red-600 text-sm">Failed: {endpointResult.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
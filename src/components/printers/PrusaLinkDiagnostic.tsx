"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface PrusaLinkDiagnosticProps {
  printerId: string;
  printerName: string;
}

export function PrusaLinkDiagnostic({ printerId, printerName }: PrusaLinkDiagnosticProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/printers/prusalink-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ printerId }),
      });

      if (!response.ok) {
        throw new Error('Failed to run diagnostic');
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PrusaLink API Diagnostic</CardTitle>
        <CardDescription>
          Test direct API communication with {printerName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {results ? (
          <div className="space-y-4">
            <div className="text-sm mb-4">
              Testing direct communication with {results.printer.name} at {results.printer.apiUrl}
            </div>
            
            <div className="space-y-3">
              {results.results.map((result: any, index: number) => (
                <div key={index} className="border rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <h3 className="font-medium">{result.endpoint}</h3>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-2">
                    URL: {result.url}
                  </div>
                  
                  {result.error ? (
                    <div className="text-sm text-red-500 mt-1">
                      Error: {result.error}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Status: <span className={result.success ? "text-green-600" : "text-red-600"}>
                        {result.status} {result.statusText}
                      </span></div>
                      <div>Success: {result.success ? "Yes" : "No"}</div>
                    </div>
                  )}
                  
                  {result.data && (
                    <details className="mt-2">
                      <summary className="text-sm font-medium cursor-pointer">
                        Response Data
                      </summary>
                      <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Run direct API tests to diagnose communication issues with your PrusaLink printer.
            </p>
            <Button onClick={runDiagnostic} disabled={isLoading}>
              {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Running Diagnostic..." : "Run Diagnostic"}
            </Button>
          </div>
        )}
      </CardContent>
      {results && (
        <CardFooter>
          <Button 
            variant="outline" 
            onClick={runDiagnostic} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? "Running..." : "Run Again"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
} 
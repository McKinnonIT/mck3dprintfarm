"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrusaLinkSetup() {
  const router = useRouter();

  const redirectToPrinters = () => {
    router.push("/printers");
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>PrusaLink Setup</CardTitle>
        <CardDescription>
          Connect to PrusaLink printers using direct HTTP API
        </CardDescription>
      </CardHeader>
      <CardContent>
          <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Ready to use PrusaLink printers</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                    This application is configured to connect directly to PrusaLink printers using the HTTP API.
                    No additional dependencies are required.
                  </p>
                  <p className="mt-2">
                    You can now add and connect to your PrusaLink printers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

          <div className="pt-4">
            <Button 
              onClick={redirectToPrinters}
              className="w-full"
            >
              Continue to Printers <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
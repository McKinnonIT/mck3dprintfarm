import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function PrusaLinkSetup() {
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const { toast } = useToast();

  // Function to check dependencies
  const checkDependencies = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/printers/check-dependencies');
      if (!response.ok) {
        throw new Error('Failed to check dependencies');
      }
      const data = await response.json();
      setCheckResult(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : String(error),
        className: "bg-destructive text-destructive-foreground border-destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Function to install dependencies
  const installDependencies = async () => {
    setIsInstalling(true);
    try {
      const response = await fetch('/api/printers/install-dependencies', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to install dependencies');
      }
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "PrusaLinkPy installed successfully",
        });
        // Recheck dependencies
        await checkDependencies();
      } else {
        throw new Error(data.error || 'Installation failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : String(error),
        className: "bg-destructive text-destructive-foreground border-destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>PrusaLink Setup</CardTitle>
        <CardDescription>
          Check your system for required dependencies to connect to PrusaLink printers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {checkResult ? (
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              {checkResult.python.installed ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <h3 className="font-medium">Python</h3>
                {checkResult.python.installed ? (
                  <p className="text-sm text-muted-foreground">
                    Found: {checkResult.python.version} ({checkResult.python.executable})
                  </p>
                ) : (
                  <p className="text-sm text-red-500">
                    Not found. Please install Python 3 to use PrusaLink printers.
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              {checkResult.prusaLinkPy.installed ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <h3 className="font-medium">PrusaLinkPy</h3>
                {checkResult.prusaLinkPy.installed ? (
                  <p className="text-sm text-muted-foreground">
                    Found: {checkResult.prusaLinkPy.version}
                  </p>
                ) : (
                  <p className="text-sm text-red-500">
                    Not found. {checkResult.prusaLinkPy.error}
                  </p>
                )}
              </div>
            </div>
            
            {!checkResult.allReady && checkResult.python.installed && (
              <div className="pt-2">
                <Button 
                  onClick={installDependencies} 
                  disabled={isInstalling}
                  className="w-full"
                >
                  {isInstalling ? "Installing..." : "Install PrusaLinkPy"}
                </Button>
              </div>
            )}
            
            {!checkResult.python.installed && (
              <div className="rounded-md bg-amber-50 p-4 mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">Python installation required</h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>
                        Python 3 is required to use PrusaLink printers. Please download and install from{' '}
                        <a 
                          href="https://www.python.org/downloads/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-amber-800 underline hover:text-amber-900"
                        >
                          python.org
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {checkResult.allReady && (
              <div className="rounded-md bg-green-50 p-4 mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">All dependencies installed</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        Your system is ready to use PrusaLink printers. You can now add and connect to your printers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Check your system for the required dependencies to connect to PrusaLink printers.
            </p>
            <Button onClick={checkDependencies} disabled={isChecking}>
              {isChecking ? "Checking..." : "Check Dependencies"}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={checkDependencies} disabled={isChecking}>
          {isChecking ? "Checking..." : "Refresh"}
        </Button>
        {checkResult?.allReady && (
          <Button className="ml-auto">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 
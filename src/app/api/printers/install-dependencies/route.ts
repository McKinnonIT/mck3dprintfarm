import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spawn } from "child_process";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // First, find a Python executable we can use
    const pythonExecutable = await findPythonExecutable();
    
    if (!pythonExecutable.found) {
      return NextResponse.json(
        { error: "Python is not installed or not found in PATH. Please install Python 3." },
        { status: 500 }
      );
    }

    // Try to install PrusaLinkPy
    const installResult = await installPrusaLinkPy(pythonExecutable.executable);

    if (!installResult.success) {
      return NextResponse.json(
        { error: installResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pythonExecutable: pythonExecutable.executable,
      message: installResult.output
    });
  } catch (error) {
    console.error("Failed to install dependencies:", error);
    return NextResponse.json(
      { error: "Failed to install dependencies" },
      { status: 500 }
    );
  }
}

async function findPythonExecutable(): Promise<{ 
  found: boolean; 
  executable?: string; 
  version?: string; 
  error?: string 
}> {
  const possibleExecutables = ['python3', 'python', 'py'];
  
  for (const executable of possibleExecutables) {
    try {
      const pythonProcess = spawn(executable, ['--version']);
      
      // Create a promise to get the result
      const result = await new Promise<boolean>((resolve) => {
        pythonProcess.on('close', (code) => {
          resolve(code === 0);
        });
        
        pythonProcess.on('error', () => {
          resolve(false);
        });
      });
      
      if (result) {
        return {
          found: true,
          executable
        };
      }
    } catch (error) {
      // Ignore errors and try the next executable
    }
  }
  
  return {
    found: false,
    error: 'No Python executable found. Please install Python 3.'
  };
}

async function installPrusaLinkPy(pythonExecutable: string): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    // First, try pip associated with the Python executable
    const pipExecutable = pythonExecutable === 'python3' ? 'pip3' : 'pip';
    
    // Use pip to install or upgrade the package
    const pipProcess = spawn(pipExecutable, ['install', 'prusaLinkPy', '--upgrade']);
    
    let output = '';
    let errorOutput = '';
    
    pipProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pipProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pipProcess.on('error', () => {
      // If direct pip fails, try using Python -m pip
      const pythonPipProcess = spawn(pythonExecutable, ['-m', 'pip', 'install', 'prusaLinkPy', '--upgrade']);
      
      let pythonPipOutput = '';
      let pythonPipErrorOutput = '';
      
      pythonPipProcess.stdout.on('data', (data) => {
        pythonPipOutput += data.toString();
      });
      
      pythonPipProcess.stderr.on('data', (data) => {
        pythonPipErrorOutput += data.toString();
      });
      
      pythonPipProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ 
            success: true, 
            output: pythonPipOutput
          });
        } else {
          resolve({
            success: false,
            output: pythonPipOutput,
            error: pythonPipErrorOutput || 'Failed to install PrusaLinkPy using Python -m pip'
          });
        }
      });
      
      pythonPipProcess.on('error', () => {
        resolve({
          success: false,
          output: '',
          error: 'Both pip and Python -m pip failed. Please install pip manually.'
        });
      });
    });
    
    pipProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ 
          success: true, 
          output: output
        });
      } else {
        // Try using Python -m pip instead
        const pythonPipProcess = spawn(pythonExecutable, ['-m', 'pip', 'install', 'prusaLinkPy', '--upgrade']);
        
        let pythonPipOutput = '';
        let pythonPipErrorOutput = '';
        
        pythonPipProcess.stdout.on('data', (data) => {
          pythonPipOutput += data.toString();
        });
        
        pythonPipProcess.stderr.on('data', (data) => {
          pythonPipErrorOutput += data.toString();
        });
        
        pythonPipProcess.on('close', (pythonPipCode) => {
          if (pythonPipCode === 0) {
            resolve({ 
              success: true, 
              output: pythonPipOutput
            });
          } else {
            resolve({
              success: false,
              output: output + '\n' + pythonPipOutput,
              error: errorOutput || pythonPipErrorOutput || 'Failed to install PrusaLinkPy'
            });
          }
        });
        
        pythonPipProcess.on('error', () => {
          resolve({
            success: false,
            output: output,
            error: errorOutput || 'Both pip and Python -m pip failed. Please install pip manually.'
          });
        });
      }
    });
  });
} 
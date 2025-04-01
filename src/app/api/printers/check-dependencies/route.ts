import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spawn } from "child_process";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check Python installation
    const pythonInfo = await findPythonExecutable();
    const prusaLinkPyStatus = pythonInfo.found 
      ? await checkPrusaLinkPy(pythonInfo.executable) 
      : { installed: false, error: "Python not found" };

    return NextResponse.json({
      python: {
        installed: pythonInfo.found,
        version: pythonInfo.version,
        executable: pythonInfo.executable,
        error: pythonInfo.error
      },
      prusaLinkPy: prusaLinkPyStatus,
      allReady: pythonInfo.found && prusaLinkPyStatus.installed
    });
  } catch (error) {
    console.error("Failed to check dependencies:", error);
    return NextResponse.json(
      { error: "Failed to check dependencies" },
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
      const result = await checkPython(executable);
      if (result.installed) {
        return {
          found: true,
          executable,
          version: result.version,
          error: undefined
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

async function checkPython(executable: string): Promise<{ 
  installed: boolean; 
  version?: string; 
  error: string 
}> {
  return new Promise((resolve) => {
    const pythonProcess = spawn(executable, ['--version']);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('error', () => {
      resolve({
        installed: false,
        error: `${executable} not found`
      });
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        // Python version output might be in stdout or stderr depending on the system
        const version = output || errorOutput;
        resolve({ 
          installed: true, 
          version: version.trim(),
          error: ''
        });
      } else {
        resolve({
          installed: false,
          error: errorOutput || `${executable} command failed`
        });
      }
    });
  });
}

async function checkPrusaLinkPy(pythonExecutable: string): Promise<{ 
  installed: boolean; 
  version?: string; 
  error: string 
}> {
  return new Promise((resolve) => {
    const pythonScript = `
import sys
try:
    import PrusaLinkPy
    print(f"PrusaLinkPy installed")
except ImportError as e:
    print(f"PrusaLinkPy not installed: {e}")
    sys.exit(1)
`;
    
    const pythonProcess = spawn(pythonExecutable, ['-c', pythonScript]);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('error', (error) => {
      resolve({
        installed: false,
        error: `Failed to execute Python: ${error.message}`
      });
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ 
          installed: true,
          version: output.trim(),
          error: '' 
        });
      } else {
        resolve({
          installed: false,
          error: errorOutput || output || 'Failed to check PrusaLinkPy'
        });
      }
    });
  });
} 
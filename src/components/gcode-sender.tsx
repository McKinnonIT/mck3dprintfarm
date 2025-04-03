'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer } from '@/types/printer';

interface GCodeSenderProps {
  printer: Printer;
}

export function GCodeSender({ printer }: GCodeSenderProps) {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({
    loading: false,
  });

  // Only show this component for Moonraker printers
  if (printer.type.toLowerCase() !== 'moonraker') {
    return null;
  }

  const sendCommand = async () => {
    if (!command) {
      setStatus({
        loading: false,
        success: false,
        message: 'Please enter a GCode command',
      });
      return;
    }

    setStatus({ loading: true });

    try {
      const response = await fetch(`/api/printers/${printer.id}/gcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({
          loading: false,
          success: true,
          message: result.message || 'Command sent successfully',
        });
      } else {
        setStatus({
          loading: false,
          success: false,
          message: result.message || 'Failed to send command',
        });
      }
    } catch (error) {
      setStatus({
        loading: false,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendCommand();
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>GCode Sender</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter GCode command (e.g., G28)"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={status.loading}
            />
            <Button onClick={sendCommand} disabled={status.loading}>
              {status.loading ? 'Sending...' : 'Send'}
            </Button>
          </div>

          {status.message && (
            <Alert variant={status.success ? 'default' : 'destructive'}>
              <AlertDescription>{status.message}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground">
            <p>Common GCode commands:</p>
            <ul className="list-disc list-inside mt-1">
              <li>G28 - Home all axes</li>
              <li>G1 X100 Y100 Z10 F3000 - Move to position</li>
              <li>M104 S200 - Set hotend temperature</li>
              <li>M140 S60 - Set bed temperature</li>
              <li>M106 S255 - Fan at full speed</li>
              <li>M107 - Fan off</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
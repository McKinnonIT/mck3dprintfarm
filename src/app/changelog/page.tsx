import React from "react";
import Link from "next/link";

export default function ChangelogPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Changelog</h1>
      
      <div className="space-y-8">
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.0.3a">Version 0.0.3a</h2>
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">Latest</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">Released: May 2024</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Improvements</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fixed Moonraker upload session cleanup using aiohttp throughout for proper session management</li>
            <li>Fixed PrusaLinkPy upload error by removing unsupported timeout parameter</li>
            <li>Fixed Python syntax error in Moonraker bridge script</li>
            <li>Enhanced error handling for printer connection failures</li>
          </ul>
        </section>
        
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.0.2a">Version 0.0.2a</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Released: June 2023</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Added support for Bambu Lab printers (X1 and P1 series)</li>
            <li>Integrated bambulabs_api Python library for printer communication</li>
            <li>Added serialNumber field to Printer model for Bambu Lab authentication</li>
            <li>Added new changelog page for version tracking</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Improvements</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Updated printer connection test to support Bambu Lab devices</li>
            <li>Enhanced printer type selection in Add/Edit printer forms</li>
            <li>Updated Docker configuration to include bambulabs_api package</li>
            <li>Made footer version number link to the changelog</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Under the Hood</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Created bambulabs-bridge.js for Python/JavaScript interoperability</li>
            <li>Updated database schema to include serialNumber field</li>
            <li>Enhanced printer-utils.ts to handle Bambu Lab authentication</li>
            <li>Updated Docker build system to include all needed Python packages (prusaLinkPy, moonraker-api, bambulabs_api)</li>
            <li>Added placeholder Bambu Lab UI components for Docker builds</li>
          </ul>
        </section>
        
        <section className="border-b pb-6">
          <h2 className="text-2xl font-semibold mb-4" id="v0.0.1a">Version 0.0.1a</h2>
          <p className="text-sm text-gray-500 mb-4">Released: April 2023</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Initial Release</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Basic 3D printer farm management functionality</li>
            <li>Support for PrusaLink printers</li>
            <li>Support for Moonraker-based printers (Klipper)</li>
            <li>User authentication and management</li>
            <li>Printer monitoring dashboard</li>
            <li>File upload and print management</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Printer status monitoring</li>
            <li>Remote print control (start, stop, pause)</li>
            <li>File management for uploaded prints</li>
            <li>Printer configuration (add, edit, delete)</li>
            <li>Docker containerization for easy deployment</li>
          </ul>
        </section>
      </div>
      
      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
} 
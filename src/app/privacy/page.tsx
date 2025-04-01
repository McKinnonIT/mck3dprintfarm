import React from "react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      
      <div className="prose max-w-none">
        <p className="mb-4">
          This privacy policy explains how the MCK 3D Print Farm application handles user data and 
          printer information. The application is designed for internal use at McKinnon Secondary College.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Data Collection</h2>
        <p className="mb-4">
          The application collects and stores the following information:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>User account information (name, email, role)</li>
          <li>3D printer configuration details</li>
          <li>Print job history</li>
          <li>Printer status information</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Data Usage</h2>
        <p className="mb-4">
          The collected data is used solely for the purpose of:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Managing and monitoring 3D printers</li>
          <li>Tracking print job history</li>
          <li>User authentication and authorization</li>
          <li>System administration and maintenance</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Data Storage</h2>
        <p className="mb-4">
          All data is stored locally within McKinnon Secondary College's infrastructure. No data is 
          shared with third parties or external services except as required for the function of the
          application (communicating with the connected 3D printers).
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">User Rights</h2>
        <p className="mb-4">
          Users have the right to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Access their user information</li>
          <li>Request modification of incorrect information</li>
          <li>Request deletion of their account (for non-administrative users)</li>
        </ul>
        <p>
          Requests related to user data should be directed to the system administrator.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Changes to This Policy</h2>
        <p className="mb-4">
          This privacy policy may be updated from time to time. Any changes will be communicated to users 
          through the application.
        </p>
      </div>
      
      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
} 
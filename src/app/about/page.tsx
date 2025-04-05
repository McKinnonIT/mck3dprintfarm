"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import packageInfo from '../../../package.json';

export default function AboutPage() {
  const [settings, setSettings] = useState({
    organizationName: "McKelvey Engineering",
    organizationWebsite: "https://engineering.wustl.edu",
    printFarmTitle: "MCK 3D Print Farm"
  });

  useEffect(() => {
    // Fetch settings when component mounts
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          organizationName: data.organizationName || "McKelvey Engineering",
          organizationWebsite: data.organizationWebsite || "https://engineering.wustl.edu",
          printFarmTitle: data.printFarmTitle || "MCK 3D Print Farm"
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 text-blue-800">{settings.printFarmTitle}</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          A state-of-the-art 3D printing facility powering innovation and creativity.
        </p>
        <div className="mt-4 inline-block bg-blue-100 px-3 py-1 rounded-full text-blue-800">
          Version {packageInfo.version}
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-white rounded-xl shadow-lg p-8 transform transition-all hover:scale-105">
          <div className="rounded-full bg-blue-100 w-12 h-12 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-blue-800">Our Mission</h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            The {settings.printFarmTitle} provides streamlined access to 3D printing technology 
            for educational, research, and innovative projects.
          </p>
          <p className="text-gray-700 leading-relaxed">
            We aim to democratize access to advanced manufacturing technologies, enabling 
            the creation of innovative projects and fostering technical skills development.
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-8 transform transition-all hover:scale-105">
          <div className="rounded-full bg-blue-100 w-12 h-12 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-blue-800">About {settings.organizationName}</h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            {settings.organizationName} is committed to providing quality education and 
            fostering innovation through cutting-edge technology and research.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed">
            Our focus on technology and practical skills helps prepare students and 
            researchers for the challenges of advanced manufacturing.
          </p>
          <a 
            href={settings.organizationWebsite} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Visit Our Website
          </a>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center p-4 bg-white bg-opacity-20 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Multi-Printer Management</h3>
            <p className="text-center">Manage various 3D printers from a single interface.</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-white bg-opacity-20 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Job Queue System</h3>
            <p className="text-center">Efficiently manage print jobs with our intuitive queue system.</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-white bg-opacity-20 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Real-time Monitoring</h3>
            <p className="text-center">Monitor print progress with live status updates and webcam feeds.</p>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center">
        <h2 className="text-2xl font-bold mb-6 text-blue-800">Have Questions?</h2>
        <Link 
          href="/contact" 
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-md"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
} 
import React from "react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">About MCK 3D Print Farm</h1>
      
      <p className="mb-6">
        The MCK 3D Print Farm application was developed for McKinnon Secondary College to manage 
        3D printers across the school. This platform enables monitoring and management of PrusaLink, 
        Moonraker-based, and Bambu Lab 3D printers, streamlining the 3D printing workflow for students and staff.
      </p>
      
      <h2 className="text-2xl font-semibold mb-4 mt-8">Technologies Used</h2>
      
      <div className="space-y-8">
        <section>
          <h3 className="text-xl font-medium mb-3">Core Frameworks & Libraries</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <a href="https://nextjs.org" target="_blank" className="text-blue-600 hover:underline font-medium">
                Next.js
              </a>
              <span> - React framework for server-rendered applications</span>
            </li>
            <li>
              <a href="https://react.dev" target="_blank" className="text-blue-600 hover:underline font-medium">
                React
              </a>
              <span> - JavaScript library for building user interfaces</span>
            </li>
            <li>
              <a href="https://www.prisma.io" target="_blank" className="text-blue-600 hover:underline font-medium">
                Prisma
              </a>
              <span> - Next-generation ORM for Node.js and TypeScript</span>
            </li>
            <li>
              <a href="https://tailwindcss.com" target="_blank" className="text-blue-600 hover:underline font-medium">
                Tailwind CSS
              </a>
              <span> - Utility-first CSS framework</span>
            </li>
            <li>
              <a href="https://next-auth.js.org" target="_blank" className="text-blue-600 hover:underline font-medium">
                NextAuth.js
              </a>
              <span> - Authentication for Next.js</span>
            </li>
          </ul>
        </section>
        
        <section>
          <h3 className="text-xl font-medium mb-3">3D Printing Integration</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <a href="https://github.com/prusa3d/prusalink" target="_blank" className="text-blue-600 hover:underline font-medium">
                PrusaLink API
              </a>
              <span> - API for controlling Prusa 3D printers</span>
            </li>
            <li>
              <a href="https://github.com/TheInsomniac/PrusaLinkPy" target="_blank" className="text-blue-600 hover:underline font-medium">
                PrusaLinkPy
              </a>
              <span> - Python library for interacting with PrusaLink</span>
            </li>
            <li>
              <a href="https://moonraker.readthedocs.io" target="_blank" className="text-blue-600 hover:underline font-medium">
                Moonraker API
              </a>
              <span> - API server for Klipper-based 3D printers</span>
            </li>
            <li>
              <a href="https://pypi.org/project/bambulabs-api/" target="_blank" className="text-blue-600 hover:underline font-medium">
                Bambu Lab API
              </a>
              <span> - Python library for controlling Bambu Lab 3D printers</span>
            </li>
          </ul>
        </section>
        
        <section>
          <h3 className="text-xl font-medium mb-3">Deployment & Containerization</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <a href="https://www.docker.com" target="_blank" className="text-blue-600 hover:underline font-medium">
                Docker
              </a>
              <span> - Container platform for packaging and running applications</span>
            </li>
            <li>
              <a href="https://github.com/features/actions" target="_blank" className="text-blue-600 hover:underline font-medium">
                GitHub Actions
              </a>
              <span> - CI/CD workflows for automated builds and deployment</span>
            </li>
          </ul>
        </section>
        
        <section>
          <h3 className="text-xl font-medium mb-3">UI Components & Utilities</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <a href="https://heroicons.com" target="_blank" className="text-blue-600 hover:underline font-medium">
                Heroicons
              </a>
              <span> - Beautiful hand-crafted SVG icons</span>
            </li>
            <li>
              <a href="https://github.com/axios/axios" target="_blank" className="text-blue-600 hover:underline font-medium">
                Axios
              </a>
              <span> - Promise-based HTTP client</span>
            </li>
            <li>
              <a href="https://github.com/diced/prisma-extension-pagination" target="_blank" className="text-blue-600 hover:underline font-medium">
                Prisma Client Extensions
              </a>
              <span> - Extensions for Prisma client</span>
            </li>
            <li>
              <a href="https://github.com/lukeed/clsx" target="_blank" className="text-blue-600 hover:underline font-medium">
                clsx
              </a>
              <span> - Utility for constructing className strings conditionally</span>
            </li>
            <li>
              <a href="https://github.com/dcastil/tailwind-merge" target="_blank" className="text-blue-600 hover:underline font-medium">
                tailwind-merge
              </a>
              <span> - Merge Tailwind CSS classes without style conflicts</span>
            </li>
          </ul>
        </section>
        
        <section>
          <h3 className="text-xl font-medium mb-3">Backend & API Utilities</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <a href="https://github.com/form-data/form-data" target="_blank" className="text-blue-600 hover:underline font-medium">
                form-data
              </a>
              <span> - Library for creating readable "multipart/form-data" streams</span>
            </li>
            <li>
              <a href="https://github.com/node-fetch/node-fetch" target="_blank" className="text-blue-600 hover:underline font-medium">
                node-fetch
              </a>
              <span> - A light-weight module that brings window.fetch to Node.js</span>
            </li>
            <li>
              <a href="https://github.com/expressjs/cors" target="_blank" className="text-blue-600 hover:underline font-medium">
                CORS
              </a>
              <span> - Express middleware for enabling CORS</span>
            </li>
            <li>
              <a href="https://github.com/expressjs/multer" target="_blank" className="text-blue-600 hover:underline font-medium">
                Multer
              </a>
              <span> - Middleware for handling multipart/form-data</span>
            </li>
            <li>
              <a href="https://github.com/dcodeIO/bcrypt.js" target="_blank" className="text-blue-600 hover:underline font-medium">
                bcryptjs
              </a>
              <span> - Password hashing function</span>
            </li>
          </ul>
        </section>
      </div>
      
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-semibold mb-4">Acknowledgments</h2>
        <p className="mb-4">
          Special thanks to the open-source community for creating and maintaining these incredible 
          tools and libraries that made this project possible.
        </p>
        <p>
          <Link href="/changelog#v0.0.3a" className="text-blue-600 hover:underline">
            Version 0.0.3a
          </Link> improves printer connectivity with enhanced error handling and fixes for Moonraker and PrusaLink printers.
          See the <Link href="/changelog" className="text-blue-600 hover:underline">full changelog</Link> for more details.
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
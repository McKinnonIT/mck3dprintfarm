"use client";

import React, { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Center, Environment, Text } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import * as THREE from "three";
import { GCodeLoader } from "three/examples/jsm/loaders/GCodeLoader";

// Define the props for the viewer
type FileViewer3DProps = {
  fileId: string;
  fileName: string;
};

// Component to load and display the STL model
function StlModel({ fileUrl }: { fileUrl: string }) {
  const geometry = useLoader(STLLoader, fileUrl);
  const material = new THREE.MeshStandardMaterial({ color: 0x007bff });
  return (
    <mesh geometry={geometry} material={material} />
  );
}

// Component to load and display G-code
function GCodeModel({ fileUrl }: { fileUrl: string }) {
  // Load G-code using THREE.GCodeLoader
  // Note: GCodeLoader returns a Group containing LineSegments
  const gcodeObject = useLoader(GCodeLoader, fileUrl);

  useEffect(() => {
    // Optional: Center the loaded G-code object
    // This can be tricky as GCodeLoader might not provide a standard bounding box
    if (gcodeObject) {
      // You might need custom logic here to find the center based on line segments
      // For now, let's rely on the <Center> component in the parent
       console.log("G-code loaded by GCodeLoader:", gcodeObject);
    }
  }, [gcodeObject]);

  // GCodeLoader returns a Group, which can be rendered directly
  return <primitive object={gcodeObject} />;
}

// Main viewer component setting up the scene
export function FileViewer3D({ fileId, fileName }: FileViewer3DProps) {
  const fileUrl = `/api/files/preview/${fileId}`;
  const fileExtension = fileName?.split('.').pop()?.toLowerCase();

  return (
    <div className="w-full h-[500px] bg-gray-200 rounded">
      <Canvas camera={{ position: [0, 100, 150], fov: 50 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        
        <Suspense fallback={<Center><Text>Loading...</Text></Center>}>
          <Center>
            {fileExtension === 'stl' ? (
              <StlModel fileUrl={fileUrl} />
            ) : fileExtension === 'gcode' || fileExtension === 'bgcode' ? (
              <GCodeModel fileUrl={fileUrl} />
            ) : (
              <Text>Unsupported file type for 3D preview</Text>
            )}
          </Center>
        </Suspense>
        
        <OrbitControls />
      </Canvas>
    </div>
  );
} 
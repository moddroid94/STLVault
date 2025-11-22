import React, { Suspense, useLayoutEffect, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Center, Html } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

interface Viewer3DProps {
  url: string;
  color?: string;
}

const Model = ({ url, color = '#3b82f6' }: Viewer3DProps) => {
  // Use generic for useLoader to define the return type as BufferGeometry
  const geometry = useLoader(STLLoader, url) as THREE.BufferGeometry;
  
  useLayoutEffect(() => {
    if (geometry) {
      geometry.computeVertexNormals();
      geometry.center();
    }
  }, [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
    </mesh>
  );
};

const Viewer3D: React.FC<Viewer3DProps> = ({ url }) => {
  const [error, setError] = useState(false);

  if (!url) return <div className="flex items-center justify-center h-full text-slate-500">No model selected</div>;
  if (error) return <div className="flex items-center justify-center h-full text-red-400">Error loading model</div>;

  return (
    <div className="w-full h-full bg-gradient-to-br from-vault-800 to-vault-900 rounded-lg overflow-hidden relative">
      <Canvas shadows camera={{ position: [0, 0, 15], fov: 50 }}>
        <Suspense fallback={<Html center><div className="text-white animate-pulse">Loading Model...</div></Html>}>
          <Stage environment="city" intensity={0.6} adjustCamera>
             <Center>
               <ErrorBoundary onError={() => setError(true)}>
                 <Model url={url} />
               </ErrorBoundary>
             </Center>
          </Stage>
          <Grid infiniteGrid fadeDistance={50} sectionColor="#475569" cellColor="#334155" />
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
        </Suspense>
      </Canvas>
      <div className="absolute bottom-4 right-4 bg-black/50 px-3 py-1 rounded text-xs text-slate-300 pointer-events-none">
        LMB: Rotate | RMB: Pan | Scroll: Zoom
      </div>
    </div>
  );
};

// Simple error boundary for the canvas content
class ErrorBoundary extends React.Component<{ children: React.ReactNode, onError: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error("3D Viewer Error:", error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default Viewer3D;

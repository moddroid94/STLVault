import React, { Suspense, useLayoutEffect, useState, useRef, useEffect, useMemo, ReactNode, Component } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Center, Html } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { Maximize, Minimize, FileWarning } from 'lucide-react';
import * as THREE from 'three';

// Defined before usage to ensure proper type resolution
interface ErrorBoundaryProps {
  children?: ReactNode;
  onError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Simple error boundary for the canvas content
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: any): ErrorBoundaryState {
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

interface Viewer3DProps {
  url: string;
  filename: string;
  color?: string;
  onLoaded?: (dimensions: { x: number; y: number; z: number }) => void;
}

const Model = ({ url, filename, color = '#3b82f6', onLoaded }: Viewer3DProps) => {
  const is3MF = useMemo(() => filename.toLowerCase().endsWith('.3mf'), [filename]);
  const Loader = is3MF ? ThreeMFLoader : STLLoader;

  // Use the appropriate loader
  const data = useLoader(Loader as any, url);

  const modelObject = useMemo(() => {
    if (is3MF) {
      return data as THREE.Group;
    }
    return data as THREE.BufferGeometry;
  }, [data, is3MF]);
  
  useLayoutEffect(() => {
    const box = new THREE.Box3();
    
    if (is3MF) {
      const group = modelObject as THREE.Group;
      
      // 3MF Fix: Replaces materials with MeshStandardMaterial to ensure shading works.
      // Some 3MF files import with MeshBasicMaterial (flat) or missing normals.
      group.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // 1. Ensure normals exist for shading calculations
          if (child.geometry) {
             child.geometry.computeVertexNormals();
          }

          // 2. Replace material with a Standard material that reacts to light
          // We use a fresh material to guarantee consistency
          child.material = new THREE.MeshStandardMaterial({
             color: 0xffffff,   // White base as requested
             roughness: 0.45,   // Lower roughness to allow highlights (defines shape better)
             metalness: 0.1,    // Slight metalness for realistic falloff
             side: THREE.DoubleSide
          });
        }
      });
      
      box.setFromObject(group);
    } else {
      const geometry = modelObject as THREE.BufferGeometry;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        box.copy(geometry.boundingBox);
      }
    }
      
    if (onLoaded) {
      const size = new THREE.Vector3();
      box.getSize(size);
      onLoaded({ x: size.x, y: size.y, z: size.z });
    }
  }, [modelObject, is3MF, onLoaded]);

  if (is3MF) {
    // 3MF files are typically Z-up. The Stage component often handles orientation well,
    // but we return a primitive group here.
    return <primitive object={modelObject} />;
  }

  return (
    <mesh geometry={modelObject as THREE.BufferGeometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
    </mesh>
  );
};

const Viewer3D: React.FC<Viewer3DProps> = ({ url, filename, onLoaded }) => {
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const unsupportedFormat = useMemo(() => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.step') || lower.endsWith('.stp')) return 'STEP';
    // 3MF is now supported
    return null;
  }, [filename]);

  // Reset error when url changes
  useEffect(() => {
    setError(false);
  }, [url]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!url) return <div className="flex items-center justify-center h-full text-slate-500">No model selected</div>;
  
  if (unsupportedFormat) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-vault-800 text-slate-400 p-6 text-center">
        <FileWarning className="w-12 h-12 mb-3 opacity-50" />
        <p className="font-medium">Preview not available</p>
        <p className="text-xs mt-1 opacity-70">{unsupportedFormat} files cannot be previewed in the browser directly. Please download to view.</p>
      </div>
    );
  }

  if (error) return <div className="flex items-center justify-center h-full text-red-400">Error loading model</div>;

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full bg-gradient-to-br from-vault-800 to-vault-900 rounded-lg overflow-hidden relative group ${isFullscreen ? 'flex items-center justify-center' : ''}`}
    >
      <Canvas shadows camera={{ position: [0, 0, 15], fov: 50 }}>
        {/* Reduced ambient light to allow the Stage directional lighting to create contrast/shadows */}
        <ambientLight intensity={0.4} />
        <Suspense fallback={<Html center><div className="text-white animate-pulse text-sm">Loading Model...</div></Html>}>
          <Stage environment="city" intensity={1} adjustCamera>
             <Center>
               <ErrorBoundary onError={() => setError(true)}>
                 <Model url={url} filename={filename} onLoaded={onLoaded} />
               </ErrorBoundary>
             </Center>
          </Stage>
          <Grid infiniteGrid fadeDistance={50} sectionColor="#475569" cellColor="#334155" />
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
        </Suspense>
      </Canvas>
      
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button 
          onClick={toggleFullscreen}
          className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>

      <div className="absolute bottom-4 right-4 bg-black/50 px-3 py-1 rounded text-xs text-slate-300 pointer-events-none">
        LMB: Rotate | RMB: Pan | Scroll: Zoom
      </div>
    </div>
  );
};

export default Viewer3D;
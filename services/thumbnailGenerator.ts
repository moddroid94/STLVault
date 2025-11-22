import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

export const generateThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const is3MF = file.name.toLowerCase().endsWith('.3mf');
    const isSTL = file.name.toLowerCase().endsWith('.stl');

    if (!isSTL && !is3MF) {
        // Skip unsupported
        reject(new Error("Unsupported file type for thumbnail"));
        return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        if (!event.target?.result) {
            reject(new Error("File read failed"));
            return;
        }
        const contents = event.target.result as ArrayBuffer;
        
        let object: THREE.Object3D;

        if (is3MF) {
            const loader = new ThreeMFLoader();
            // 3MFLoader parse returns a Group
            object = loader.parse(contents);
        } else {
            const loader = new STLLoader();
            const geometry = loader.parse(contents);
            const material = new THREE.MeshStandardMaterial({ 
                color: 0x3b82f6,
                roughness: 0.5,
                metalness: 0.2 
            });
            object = new THREE.Mesh(geometry, material);
        }

        // Setup scene for snapshot
        const scene = new THREE.Scene();
        // Transparent background
        scene.background = null; 

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        
        // Center and scale
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Move object to center
        object.position.sub(center);
        scene.add(object);

        // Position camera to fit object
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.6; // Zoom out slightly for padding
        camera.position.z = cameraZ;
        camera.position.y = cameraZ * 0.4; // Slight angle
        camera.position.x = cameraZ * 0.4; // Slight angle
        camera.lookAt(0, 0, 0);
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(-5, -5, -10);
        scene.add(backLight);

        // Render
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(300, 300);
        renderer.render(scene, camera);

        const dataUrl = renderer.domElement.toDataURL('image/png');
        
        // Clean up
        if (!is3MF) {
             // Dispose geometry/material created manually for STL
             (object as THREE.Mesh).geometry.dispose();
             ((object as THREE.Mesh).material as THREE.Material).dispose();
        }
        renderer.dispose();

        resolve(dataUrl);
      } catch (e) {
        console.error("Error generating thumbnail", e);
        reject(e);
      }
    };

    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};
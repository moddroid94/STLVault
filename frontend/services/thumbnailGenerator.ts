import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { LoadStepFromFile } from "@/components/STEPLoader";

export const generateThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const is3MF = file.name.toLowerCase().endsWith(".3mf");
    const isSTL = file.name.toLowerCase().endsWith(".stl");
    const isSTP =
      file.name.toLowerCase().endsWith(".step") ||
      file.name.toLowerCase().endsWith(".stp");

    if (!isSTL && !is3MF && !isSTP) {
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
        const scene = new THREE.Scene();
        let object: THREE.Object3D;
        const box = new THREE.Box3();
        if (is3MF) {
          const loader = new ThreeMFLoader();
          // 3MFLoader parse returns a Group
          object = loader.parse(contents);
        } else if (isSTL) {
          const loader = new STLLoader();
          const geometry = loader.parse(contents);
          const material = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            roughness: 0.5,
            metalness: 0.2,
          });
          object = new THREE.Mesh(geometry, material);
          object.rotation.y = 0.3;
        } else if (isSTP) {
          console.log("STP Detected");
          object = new THREE.Group();
          (async () => {
            await LoadStepFromFile(contents).then((group) => (object = group));
            object.rotation.y = 90;
            object.rotation.z = -0.3;
            box.setFromObject(object);
            scene.add(object);
            // Setup scene for snapshot

            // Transparent background

            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);

            // Center and scale

            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Move object to center

            // Position camera to fit object
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 2.5; // Zoom out slightly for padding
            camera.position.set(center.x, center.y, cameraZ);
            camera.up.set(0.0, -1.0, 0.0);
            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);

            dirLight.position.set(
              camera.position.x,
              camera.position.y,
              camera.position.z,
            );
            dirLight.lookAt(center);
            scene.add(dirLight);

            const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
            backLight.position.set(-5, -5, -10);
            scene.add(backLight);

            // Render
            const renderer = new THREE.WebGLRenderer({
              alpha: true,
              antialias: true,
              preserveDrawingBuffer: true,
            });
            renderer.setSize(300, 300);
            camera.lookAt(center);
            renderer.render(scene, camera);

            const dataUrl = renderer.domElement.toDataURL("image/png");
            renderer.dispose();
            // Clean up
            if (!is3MF && !isSTP) {
              // Dispose geometry/material created manually for STL
              (object as THREE.Mesh).geometry.dispose();
              ((object as THREE.Mesh).material as THREE.Material).dispose();
            }

            resolve(dataUrl);
          })();
        }
        if (!isSTP) {
          box.setFromObject(object);
          scene.add(object);
          // Setup scene for snapshot

          // Transparent background

          const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
          camera.up.set(0.0, -1.0, 0.0);

          // Center and scale

          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          // Move object to center

          // Position camera to fit object
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          cameraZ *= 3.5; // Zoom out slightly for padding
          camera.position.set(center.x, center.y, cameraZ);

          // Add lights
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
          scene.add(ambientLight);

          const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);

          dirLight.position.set(
            camera.position.x,
            camera.position.y,
            camera.position.z,
          );
          dirLight.lookAt(center);
          scene.add(dirLight);

          const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
          backLight.position.set(-5, -5, -10);
          scene.add(backLight);

          // Render
          const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
          });
          renderer.setSize(300, 300);
          camera.lookAt(center);
          renderer.render(scene, camera);

          const dataUrl = renderer.domElement.toDataURL("image/png");
          renderer.dispose();
          // Clean up
          if (!is3MF && !isSTP) {
            // Dispose geometry/material created manually for STL
            (object as THREE.Mesh).geometry.dispose();
            ((object as THREE.Mesh).material as THREE.Material).dispose();
          }
          resolve(dataUrl);
        }
      } catch (e) {
        console.error("Error generating thumbnail", e);
        reject(e);
      }
    };

    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

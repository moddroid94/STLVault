import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import occtimportjs from "occt-import-js";
import occtWasmUrl from "occt-import-js/dist/occt-import-js.wasm?url";
import occtWorkerUrl from "occt-import-js/dist/occt-import-js-worker.js?url";

export async function LoadStep(fileUrl) {
  const targetObject = new THREE.Object3D();

  const initOcct = (await import("occt-import-js")).default;
  const occt = await initOcct({
    locateFile: (file: string) => {
      if (file.endsWith(".wasm")) return occtWasmUrl;
      if (file.endsWith(".worker.js")) return occtWorkerUrl;
      return file;
    },
  });

  let response = await fetch(fileUrl);
  let buffer = await response.arrayBuffer();

  // read the imported step file
  let fileBuffer = new Uint8Array(buffer);
  let result = occt.ReadStepFile(fileBuffer);
  let geometry = new THREE.BufferGeometry();
  // process the geometries of the result
  for (let resultMesh of result.meshes) {
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(resultMesh.attributes.position.array, 3),
    );
    if (resultMesh.attributes.normal) {
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(resultMesh.attributes.normal.array, 3),
      );
    }

    const index = Uint16Array.from(resultMesh.index.array);
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.scale(2.0, 2.0, 2.0);
    geometry.attributes.position.needsUpdate = true;
  }
  return geometry;
}

export async function LoadStepFromFile(fileBuffer) {
  const initOcct = (await import("occt-import-js")).default;
  const occt = await initOcct({
    locateFile: (file: string) => {
      if (file.endsWith(".wasm")) return occtWasmUrl;
      if (file.endsWith(".worker.js")) return occtWorkerUrl;
      return file;
    },
  });

  // read the imported step file
  let fileintBuffer = new Uint8Array(fileBuffer);
  let result = occt.ReadStepFile(fileintBuffer, null);
  // process the geometries of the result
  const group = new THREE.Group();
  for (let resultMesh of result.meshes) {
    const { mesh, edges } = BuildMesh(resultMesh, false);
    mesh.scale.set(1.0, 1.0, 1.0);
    group.add(mesh);

    if (edges) {
      group.add(edges);
    }
  }
  return group;
}

function BuildMesh(geometryMesh, showEdges) {
  let geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(geometryMesh.attributes.position.array, 3),
  );
  if (geometryMesh.attributes.normal) {
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(geometryMesh.attributes.normal.array, 3),
    );
  }
  geometry.name = geometryMesh.name;
  const index = Uint32Array.from(geometryMesh.index.array);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));

  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
  const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, // White base as requested
    roughness: 0.45, // Lower roughness to allow highlights (defines shape better)
    metalness: 0.1, // Slight metalness for realistic falloff
    side: THREE.DoubleSide,
  });
  let materials = [defaultMaterial];
  const edges = showEdges ? new THREE.Group() : null;

  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, defaultMaterial);
  mesh.name = geometryMesh.name;
  mesh.frustumCulled = false;

  if (edges) {
    edges.renderOrder = mesh.renderOrder + 1;
  }

  return { mesh, geometry, edges };
}

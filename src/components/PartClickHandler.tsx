// src/components/PartClickHandler.tsx
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useConfigStore } from '../state/useConfigStore';
import * as THREE from 'three';

export function PartClickHandler() {
  const { camera, scene, gl } = useThree();
  const manifest = useConfigStore(state => state.manifest);
  const setModalOpen = useConfigStore(state => state.setModalOpen);
  const setModalPartId = useConfigStore(state => state.setModalPartId);

  useEffect(() => {
    if (!manifest) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Find which part a mesh belongs to
    const findPartForMesh = (meshName: string): string | null => {
      if (!manifest.parts) return null;

      for (const part of manifest.parts) {
        const selectors = part.meshSelectors || [];
        
        for (const selector of selectors) {
          // Exact match
          if (meshName === selector) return part.id;
          
          // Wildcard match
          if (selector.startsWith('*') && selector.endsWith('*')) {
            const pattern = selector.slice(1, -1);
            if (meshName.includes(pattern)) return part.id;
          } else if (selector.startsWith('*')) {
            const pattern = selector.slice(1);
            if (meshName.endsWith(pattern)) return part.id;
          } else if (selector.endsWith('*')) {
            const pattern = selector.slice(0, -1);
            if (meshName.startsWith(pattern)) return part.id;
          }
        }
      }
      return null;
    };

    // Handle click only - no hover effects
    const onClick = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const intersect of intersects) {
        const mesh = intersect.object as THREE.Mesh;
        if (!mesh.isMesh) continue;

        const partId = findPartForMesh(mesh.name);
        if (partId && manifest.configurableParts?.includes(partId)) {
          console.log('🎯 Clicked part:', partId, 'from mesh:', mesh.name);
          
          // Open the modal for this part
          setModalPartId(partId);
          setModalOpen(true);
          break;
        }
      }
    };

    // Add event listener
    gl.domElement.addEventListener('click', onClick);

    // Cleanup
    return () => {
      gl.domElement.removeEventListener('click', onClick);
    };
  }, [camera, scene, gl, manifest, setModalOpen, setModalPartId]);

  return null;
}

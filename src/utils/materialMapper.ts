// src/utils/materialMapper.ts
import * as THREE from 'three';
import { Material } from './manifestValidator';

/**
 * Creates a Three.js material from a manifest material definition
 */
export function createMaterialFromManifest(materialDef: Material): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial();

  if ('color' in materialDef) {
    // Simple material
    material.color.set(materialDef.color);
    material.metalness = materialDef.metalness;
    material.roughness = materialDef.roughness;
  } else if ('pbrMetallicRoughness' in materialDef) {
    // PBR material
    const pbr = materialDef.pbrMetallicRoughness;
    
    // Load textures
    const textureLoader = new THREE.TextureLoader();
    
    if (pbr.baseColor) {
      material.map = textureLoader.load(pbr.baseColor);
      material.map.flipY = false; // KTX2 textures don't need flipping
    }
    
    if (pbr.textureRoughness) {
      material.roughnessMap = textureLoader.load(pbr.textureRoughness);
      material.roughnessMap.flipY = false;
    }
    
    if (pbr.textureMetallic) {
      material.metalnessMap = textureLoader.load(pbr.textureMetallic);
      material.metalnessMap.flipY = false;
    }
    
    if (pbr.textureNormal) {
      material.normalMap = textureLoader.load(pbr.textureNormal);
      material.normalMap.flipY = false;
    }
    
    if (pbr.textureAO) {
      material.aoMap = textureLoader.load(pbr.textureAO);
      material.aoMap.flipY = false;
    }
  }

  // Common settings
  material.needsUpdate = true;
  
  return material;
}

/**
 * Applies materials to meshes based on selectors
 */
export function applyMaterialsToModel(
  model: THREE.Object3D,
  materialMap: Record<string, Material>
): void {
  const appliedMaterials = new Map<string, THREE.Material>();

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Check each material selector
      Object.entries(materialMap).forEach(([selector, materialDef]) => {
        if (matchesSelector(child, selector)) {
          // Reuse material if already created for this definition
          const materialKey = JSON.stringify(materialDef);
          let material = appliedMaterials.get(materialKey);
          
          if (!material) {
            material = createMaterialFromManifest(materialDef);
            appliedMaterials.set(materialKey, material);
          }
          
          child.material = material;
        }
      });
    }
  });
}

/**
 * Checks if a mesh matches a selector (name or regex)
 */
function matchesSelector(mesh: THREE.Mesh, selector: string): boolean {
  // Direct name match
  if (mesh.name === selector) {
    return true;
  }
  
  
  // Try regex match
  try {
    const regex = new RegExp(selector);
    if (regex.test(mesh.name)) {
      return true;
    }
  } catch {
    // If regex is invalid, fallback to string includes
    if (mesh.name.includes(selector)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Gets all mesh names from a model (for debugging)
 */
export function getAllMeshNames(model: THREE.Object3D): string[] {
  const names: string[] = [];
  
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name) {
      names.push(child.name);
    }
  });
  
  return names;
}
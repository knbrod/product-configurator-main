// src/components/ModelViewer/TestModelViewer.tsx
import { useRef, useEffect, Suspense, useMemo, useState, useCallback } from 'react';
import { useGLTF, OrbitControls, Environment, ContactShadows, Center, useTexture } from '@react-three/drei';
import { useConfigStore } from '../../state/useConfigStore';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

// ================================================================
// FLEXIBLE MESH MATCHING UTILITIES
// ================================================================

/**
 * Checks if a mesh name matches a part selector using flexible pattern matching.
 * Supports:
 * 1. Exact matches (backward compatible)
 * 2. Wildcard matching with *
 * 3. Partial keyword matching
 * 4. Pattern-based matching for variants
 */
function meshMatchesSelector(meshName: string, selector: string): boolean {
  // 1. EXACT MATCH (fastest, backward compatible)
  if (meshName === selector) {
    return true;
  }

  // 2. WILDCARD MATCHING: selector contains *
  // Example: "M200_Rifle_-_*_Suppressor*" matches any suppressor variant
  if (selector.includes('*')) {
    const regexPattern = selector
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Replace * with .*
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(meshName);
  }

  // 3. PARTIAL KEYWORD MATCHING
  // If selector is just a keyword like "Barrel" or "Suppressor"
  // Check if mesh name contains it (case-insensitive)
  if (!selector.includes('_') && !selector.includes('-')) {
    return meshName.toLowerCase().includes(selector.toLowerCase());
  }

  // 4. PATTERN MATCHING: Remove variant-specific parts
  // Extract base component name from both selector and mesh
  const normalizePattern = (str: string): string => {
    // Remove common variant indicators: numbers, specific model codes
    return str
      .replace(/\d+/g, 'N') // Replace all numbers with N
      .replace(/-\d+$/g, '') // Remove trailing -1, -2, etc.
      .toLowerCase();
  };

  const normalizedMesh = normalizePattern(meshName);
  const normalizedSelector = normalizePattern(selector);

  // Check if normalized patterns match
  if (normalizedMesh.includes(normalizedSelector) || 
      normalizedSelector.includes(normalizedMesh)) {
    return true;
  }

  return false;
}

/**
 * Finds which part ID a mesh belongs to using flexible matching
 */
function findPartForMesh(
  meshName: string, 
  configurableParts: string[], 
  manifest: any
): string | null {
  for (const partId of configurableParts) {
    const part = manifest.parts?.find((p: any) => p.id === partId);
    if (!part?.meshSelectors) continue;

    // Check if any selector matches this mesh
    for (const selector of part.meshSelectors) {
      if (meshMatchesSelector(meshName, selector)) {
        return partId;
      }
    }
  }
  return null;
}

/**
 * Checks if a mesh should be excluded from color/pattern changes
 * based on the part's excludeFromColor array
 */
function isExcludedFromColor(
  meshName: string,
  partId: string,
  manifest: any
): boolean {
  const part = manifest.parts?.find((p: any) => p.id === partId);
  if (!part?.excludeFromColor) return false;

  // Check if this mesh matches any of the exclusion patterns
  for (const exclusion of part.excludeFromColor) {
    if (meshMatchesSelector(meshName, exclusion)) {
      console.log(`🚫 Mesh "${meshName}" excluded from color by part "${partId}"`);
      return true;
    }
  }
  return false;
}

// ================================================================
// FIXED BLACK PARTS
// ================================================================

// Fixed parts that are always black and cannot be changed
const FIXED_BLACK_PARTS = [
  // Dowel pins and small hardware
  "98381A508_Dowel_Pin_98381A508",
  "98381A508_Dowel_Pin_98381A509",
  "Dowel_Pins_MASTER_D125x3125STEP",
  
  // Rail screws
  "CT_1-003_Rail_Screw_91251A192",
  "CT_1-003_Rail_Screw_91251A193", 
  "CT_1-003_Rail_Screw_91251A194",
  "CT_1-003_Rail_Screw_91251A195",
  
  // Stock lock springs (NOT the lock itself - that should change color now)
  "CT_1-005_Stock_Lock_Spring_1986K616",
  "CT_1-005_Stock_Lock_Spring_1986K617",
  "CT_1-007_Cover_Plate_Screw_91251A191",
  "CT_1-007_Cover_Plate_Screw_91251A192",
  
  // Ratchet components
  "CT_1-008_Ratchet",
  "CT_1-009_Ratchet_Spring_1986K75",
  "CT_1-010_Ratchet_Pin",
  "CT_1-011_Ratchet_Pin_Head",
  "CT_1-011_Ratchet_Pin_Head001",
  
  // Handle pins and mount
  "CT_1-012_Handle_Pin_98470A136",
  "CT_1-012_Handle_Pin_98470A137",
  "CT_1-012_Handle_Pin_98470A138",
  "CT_1-012_Handle_Pin_98470A139",
  "CT_1-014_Handle_Mount_Screw_91251A542",
  "CT_1-014_Handle_Mount_Screw_91251A543",
  
  // Bolt release screws (NOT the release itself - that should change color now)
  "CT_1-016_Bolt_Release_Screw_91259A465",
  "CT_1-017_Bolt_Release_Detent_90145A507",
  "CT_1-018_Bolt_Release_Spring_1986K55",
  "CT_1-019_Bolt_Release_Roll_Pin_92373A141",
  
  // Trigger components
  "CT_1-021_Trigger_Pin_98380A479",
  "CT_1-021_Trigger_Pin_98380A480",
  "CT_1-023_Trigger_Guard_Screw_91274A064",
  "CT_1-023_Trigger_Guard_Screw_91274A065",
  "CT_1-023_Trigger_Guard_Screw_91274A066",
  // CT_1-024_Mag_Release - REMOVED, should change color now
  "CT_1-025_Mag_Release_Spring_9435K34",
  "CT_1-026_Mag_Release_Roll_Pin_92373A185",
  "CT_1-028_Pistol_Grip_Screw_91251A540",
  "CT_1-027_Pistol_Grip_-_B5_Type_22",
  
  // Bolt components
  "CT_2-001_Bolt_Head",
  "CT_2-002_Bolt_Guide", 
  "CT_2-003_Bolt_Guide_Spring_Smalley_SSR-0100-H",
  "CT_2-004_Bolt_Retainer_Pin",
  "CT_2-005_Bolt_Body",
  "CT_2-010_Cam_Detent_9291K048",
  "CT_2-010_Cam_Detent_9291K47",
  "CT_2-011_Cam_Spring_9435K42",
  "CT_2-012_Sear",
  "CT_2-013_Firing_Pin",
  "CT_2-014_Firing_Pin_Spring_Compressed",
  "CT_2-015_Locking_Ring",
  "CT_2-016_Firing_Pin_Retainer",
  "CT_2-017_Firing_Pin_Tensioner",
  "CT_2-018_Extractor",
  "CT_2-019_Extractor_Spring_1986K56",
  "CT_2-020_Extractor_Detent_9291K45",
  "CT_2-021_Ejector",
  "CT_2-022_Ejector_Spring_1986K49",
  "CT_2-023_Ejector_Roll_Pin_92373A179",
  
  // Barrel components
  "CT_3-005_Barrel_Alignment_Pin_90145A501",
  
  // Stock components (NOT CT_4-016_Stock_Rod_Spacer - that should change color now)
  "CT_4-002_Recoil_Pad_Screw_91251A342",
  "CT_4-002_Recoil_Pad_Screw_91251A343",
  "CT_4-004L_Stock_Rod_Left",
  "CT_4-004R_Stock_Rod_Right",
  "CT_4-005_Stock_Rod_Screw_91253A537",
  "CT_4-005_Stock_Rod_Screw_91253A538",
  "CT_4-007_Cheek_Piece_Bracket_Screw_91253A006",
  "CT_4-007_Cheek_Piece_Bracket_Screw_91253A007",
  "CT_4-009_Cheek_Piece_Retainer_Dowel_90145A506",
  "CT_4-010_Cheek_Piece_Screw_91255A267",
  "CT_4-010_Cheek_Piece_Screw_91255A268",
  "CT_4-013_Monopod_Screw_91251A541",
  "CT_4-014_Monopod_Spring_1986K59",
  "CT_4-015_Monopod_Retainer_Screw_91255A194",
  
  // Hand guard clamp
  "CT_5-003_Handguard_Clamp_Screw_91251A540",
  
  // Handle clamp screws
  "CT_5-006_Handle_Clamp_Screw_91251A535",
  "CT_5-006_Handle_Clamp_Screw_91251A536",
  "CT_5-006_Handle_Clamp_Screw_91251A537",
  "CT_5-006_Handle_Clamp_Screw_91251A538",
  
  // Bipod screws and small parts
  "CT_5-008-2_Bipod_Bracket_Screw_64835K067",
  "CT_5-008-2_Bipod_Bracket_Screw_64835K068", 
  "CT_5-008-2_Bipod_Bracket_Screw_64835K66",
  "CT_5-012-2_Bipod_Locking_Pin_Spring_1986K751",
  "CT_5-012-2_Bipod_Locking_Pin_Spring_1986K752",
  "CT_5-014-2_Swivel_Washer_92678A182",
  "CT_5-014-2_Swivel_Washer_92678A183",
  "CT_5-014-2_Swivel_Washer_92678A184",
  "CT_5-014-2_Swivel_Washer_92678A185",
  "CT_5-015_Bipod_Swivel_Screw_91259A619",
  "CT_5-015_Bipod_Swivel_Screw_91259A620",
  "CT_5-019-2_Bipod_Foot_Release_Housing_Roll_Pin_92373A147",
  "CT_5-019-2_Bipod_Foot_Release_Housing_Roll_Pin_92373A148",
  "CT_5-021_Bipod_Foot_Release_Spring_1986K065",
  "CT_5-021_Bipod_Foot_Release_Spring_1986K64",
  "CT_5-022_Bipod_Foot_Release_Screw_91255A106",
  "CT_5-022_Bipod_Foot_Release_Screw_91255A107",
  "CT_5-023-2_Bipod_Foot_Detent_8490A822",
  "CT_5-023-2_Bipod_Foot_Detent_8490A823",
  "CT_5-023-2_Bipod_Foot_Detent_8490A825",
  "CT_5-023-2_Bipod_Foot_Detent_8490A826",
  "CT_5-024-2_Bipod_Rubber_Foot",
  "CT_5-024-2_Bipod_Rubber_Foot001",
  
  // Magazine components
  "CT_6-002_Magazine_Follower",
  
  // Clips and small parts
  "E_CLIP_125_97431A240STEP",
  "E_CLIP_125_97431A240STEP001",
  
  // Limbsaver butt pad
  "Limbsaver_TRAP_GRIND_TO_FIT_Butt_Padstep",
  "CT_4-001_Butt_Pad_-_Limbsaver_TRAP_GRIND_TO_FITstep",
  
  // Set screws
  "set_screws,_cone_point_MASTER_8-32_x_375STEP",
  "set_screws,_oval_point_MASTER_4-40_x_500_STEP", 
  "set_screws,_oval_point_MASTER_8-32_x_500_STEP",
  
  // Additional components
  "CPREM1STEP",
  "CPREM2STEP", 
  "HOREM700RH-2STEP",
  "KNREM700BSALOSTEP",
  "KNREM700BSASHSTEP",
  "SAREM700BBLSTEP"
];

// Texture cache to avoid reloading
const textureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();

function createMaterialFromDefinition(materialDef: any, partId?: string): THREE.MeshStandardMaterial {
  console.log('Creating material from definition:', materialDef, 'for part:', partId);
  
  // Check if this is a texture-based material
  if (materialDef.type === 'texture' && materialDef.textureUrl) {
    console.log('🎨 Loading texture:', materialDef.textureUrl);
    
    // Create material first
    const material = new THREE.MeshStandardMaterial({
      metalness: materialDef.metalness ?? 0.2,
      roughness: materialDef.roughness ?? 0.8,
    });
    
    // Check cache first - but use a unique key per part to allow different repeat values
    const cacheKey = `${materialDef.textureUrl}_${partId}`;
    let texture = textureCache.get(cacheKey);
    
    if (!texture) {
      // Check if we have the base texture cached
      const baseTexture = textureCache.get(materialDef.textureUrl);
      
      if (baseTexture) {
        // Clone the base texture so we can set different repeat values
        texture = baseTexture.clone();
        texture.needsUpdate = true;
      } else {
        // Load new texture
        texture = textureLoader.load(
          materialDef.textureUrl, 
          (loadedTexture) => {
            console.log('✅ Texture loaded successfully:', materialDef.textureUrl);
            loadedTexture.wrapS = THREE.RepeatWrapping;
            loadedTexture.wrapT = THREE.RepeatWrapping;
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.anisotropy = 16;
            loadedTexture.needsUpdate = true;
            
            // Update material with loaded texture
            material.map = loadedTexture;
            material.needsUpdate = true;
          },
          undefined,
          (error) => {
            console.error('❌ Error loading texture:', materialDef.textureUrl, error);
          }
        );
        
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 16;
        
        // Cache the base texture
        textureCache.set(materialDef.textureUrl, texture);
      }
      
      // Set texture repeat based on part
      if (materialDef.repeat && partId) {
        const repeatSettings = materialDef.repeat[partId] || materialDef.repeat.default || [1, 1];
        texture.repeat.set(repeatSettings[0], repeatSettings[1]);
        console.log(`🎨 Set texture repeat for ${partId}:`, repeatSettings);
      } else {
        texture.repeat.set(1, 1);
      }
      
      // Cache this part-specific texture
      textureCache.set(cacheKey, texture);
    }
    
    // Apply texture to material
    material.map = texture;
    
    console.log('✅ Created texture material for:', partId, 'with texture:', materialDef.textureUrl);
    return material;
  }
  
  // Otherwise create a color material
  const material = new THREE.MeshStandardMaterial({
    color: materialDef.color || '#666666',
    metalness: materialDef.metalness ?? 0.3,
    roughness: materialDef.roughness ?? 0.8,
  });
  
  console.log('Created color material:', materialDef.color || '#666666');
  return material;
}

function RifleModel({ productPath, modelFile, onLoadComplete }: { productPath: string; modelFile: string; onLoadComplete?: () => void }) {
  const modelRef = useRef<THREE.Group>(null);
  const modelUrl = `${productPath}/products/example-product/${modelFile}`;
  
  // State for highlighting
  const [hoveredMesh, setHoveredMesh] = useState<THREE.Mesh | null>(null);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null);
  
  console.log('🔫 Loading model from:', modelUrl);
  
  const { scene } = useGLTF(modelUrl);
  const { 
    finishMode, 
    selectedPattern, 
    selectedColors,
    partColorOverrides,
    getSelectedMaterials,
    manifest,
    modalPartId,
    selectedSuppressor
  } = useConfigStore();
  
  console.log('RifleModel: Loaded GLB successfully');
  console.log('RifleModel: Current finish mode:', finishMode);
  console.log('RifleModel: Selected pattern:', selectedPattern);
  console.log('RifleModel: Selected colors:', selectedColors);
  console.log('RifleModel: Part color overrides:', partColorOverrides);
  console.log('RifleModel: Selected suppressor:', selectedSuppressor);
  
  // Create a stable scene copy that won't be re-cloned
  const stableScene = useMemo(() => {
    const clonedScene = scene.clone();
    console.log('RifleModel: Created stable scene clone for model:', modelFile);
    
    // Call onLoadComplete when model is ready
    if (onLoadComplete) {
      // Small delay to ensure everything is rendered
      setTimeout(() => onLoadComplete(), 100);
    }
    
    return clonedScene;
  }, [scene, modelFile, onLoadComplete]);

  // Handle pointer move for hover effect - TRIGGER NOW SELECTABLE
  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    
    if (event.object instanceof THREE.Mesh && manifest) {
      const partId = findPartForMesh(
        event.object.name,
        manifest.configurableParts || [],
        manifest
      );
      
      // Trigger is now selectable! Removed the exclusion
      if (partId) {
        setHoveredMesh(event.object);
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredMesh(null);
        document.body.style.cursor = 'default';
      }
    }
  }, [manifest]);

  // Handle pointer leave
  const handlePointerLeave = useCallback(() => {
    setHoveredMesh(null);
    document.body.style.cursor = 'default';
  }, []);

  // Handle click for selection - TRIGGER NOW SELECTABLE
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    
    if (event.object instanceof THREE.Mesh && manifest) {
      const partId = findPartForMesh(
        event.object.name,
        manifest.configurableParts || [],
        manifest
      );
      
      // Trigger is now selectable! Removed the exclusion
      if (partId) {
        // If clicking the same part again, deselect it
        if (selectedMesh) {
          const currentPartId = findPartForMesh(
            selectedMesh.name,
            manifest.configurableParts || [],
            manifest
          );
          if (currentPartId === partId) {
            setSelectedMesh(null);
            console.log('🎯 Deselected part:', partId);
            return;
          }
        }
        
        setSelectedMesh(event.object);
        console.log('🎯 Selected mesh:', event.object.name, '→ Part:', partId);
      } else {
        // Clicked on non-selectable part, clear selection
        setSelectedMesh(null);
      }
    } else {
      // Clicked on empty space, clear selection
      setSelectedMesh(null);
    }
  }, [manifest, selectedMesh]);

  // Clear selection when modal closes
  useEffect(() => {
    console.log('Modal state changed, modalPartId:', modalPartId);
    if (!modalPartId) {
      console.log('Modal closed, clearing selectedMesh');
      setSelectedMesh(null);
    }
  }, [modalPartId]);

  // Apply materials when selections change - NOW WITH FLEXIBLE MATCHING
  useEffect(() => {
    if (modelRef.current && manifest) {
      console.log('=== Applying Materials with Flexible Matching ===');
      console.log('RifleModel: Applying materials for finish mode:', finishMode);
      console.log('RifleModel: Part overrides in effect:', partColorOverrides);
      
      const matchedParts = new Set<string>();
      const unmatchedMeshes: string[] = [];
      
      // Calculate which part IDs are hovered/selected for group highlighting
      const hoveredPartId = hoveredMesh && manifest ? findPartForMesh(
        hoveredMesh.name,
        manifest.configurableParts || [],
        manifest
      ) : null;

      const selectedPartId = selectedMesh && manifest ? findPartForMesh(
        selectedMesh.name,
        manifest.configurableParts || [],
        manifest
      ) : null;
      
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Check if this part should be fixed black - USE EXACT MATCHING ONLY
          const isFixedBlack = FIXED_BLACK_PARTS.includes(child.name);
          
          if (isFixedBlack) {
            child.material = new THREE.MeshStandardMaterial({
              color: "#1a1a1a",
              metalness: 0.2,
              roughness: 0.8,
            });
            return;
          }

          // ============================================
          // SPECIAL CASE: Direct_Thread_HUB_Mount
          // ============================================
          // This piece connects barrel to suppressor and should:
          // - Match suppressor color when suppressor is attached
          // - Be configurable independently when no suppressor
          if (child.name === 'Direct_Thread_HUB_Mount') {
            // Check if a suppressor is currently selected (not 'none')
            if (selectedSuppressor && selectedSuppressor !== 'none') {
              // Suppressor is attached - match its color
              console.log('🔧 Hub mount: Matching suppressor color');
              
              // Find the suppressor's material by looking at muzzleBrake part's current color
              const muzzleBrakePartId = 'muzzleBrake';
              let suppressorMaterial: THREE.MeshStandardMaterial | null = null;
              
              // Check if muzzle brake has a color override (in pattern mode with custom color)
              if (partColorOverrides[muzzleBrakePartId]) {
                const colorOption = manifest.finishModes.colors?.options?.find(
                  (option: any) => option.id === partColorOverrides[muzzleBrakePartId]
                );
                if (colorOption) {
                  suppressorMaterial = createMaterialFromDefinition(colorOption.material, muzzleBrakePartId);
                }
              } 
              // Otherwise use the current finish mode selection
              else if (finishMode === 'patterns' && selectedPattern) {
                const patternOption = manifest.finishModes.patterns?.options?.find(
                  (option: any) => option.id === selectedPattern
                );
                if (patternOption) {
                  suppressorMaterial = createMaterialFromDefinition(patternOption.material, muzzleBrakePartId);
                }
              } else if (finishMode === 'colors' && selectedColors[muzzleBrakePartId]) {
                const colorOption = manifest.finishModes.colors?.options?.find(
                  (option: any) => option.id === selectedColors[muzzleBrakePartId]
                );
                if (colorOption) {
                  suppressorMaterial = createMaterialFromDefinition(colorOption.material, muzzleBrakePartId);
                }
              }
              
              // Apply the suppressor material to hub mount
              if (suppressorMaterial) {
                if (Array.isArray(child.material)) {
                  child.material = child.material.map(() => suppressorMaterial!.clone());
                } else {
                  child.material = suppressorMaterial;
                }
                child.material.needsUpdate = true;
                console.log('✅ Hub mount matched to suppressor color');
                return; // Skip normal material application
              }
            }
            
            // If no suppressor or couldn't find suppressor material, 
            // let it fall through to normal configurable part logic below
            console.log('🔧 Hub mount: Using configurable color (no suppressor)');
          }

          // Check if this mesh should get material applied
          let shouldApplyMaterial = false;
          let materialToApply: THREE.MeshStandardMaterial | null = null;

          // Use flexible matching system
          if (manifest.configurableParts && manifest.finishModes) {
            // Find which part this mesh belongs to using flexible matching
            const partId = findPartForMesh(
              child.name,
              manifest.configurableParts,
              manifest
            );

            if (partId) {
              // 🔥 NEW: Check if this specific mesh is excluded from color changes
              if (isExcludedFromColor(child.name, partId, manifest)) {
                child.material = new THREE.MeshStandardMaterial({
                  color: "#1a1a1a",
                  metalness: 0.2,
                  roughness: 0.8,
                });
                return;
              }

              matchedParts.add(partId);
              shouldApplyMaterial = true;
              console.log(`✓ Matched mesh "${child.name}" to part "${partId}"`);

              if (finishMode === 'patterns' && selectedPattern) {
                // Check if this part has a color override
                if (partColorOverrides[partId]) {
                  console.log('🎨 Applying color override to', partId, ':', partColorOverrides[partId]);
                  const colorOption = manifest.finishModes.colors?.options?.find(
                    (option: any) => option.id === partColorOverrides[partId]
                  );
                  if (colorOption) {
                    materialToApply = createMaterialFromDefinition(colorOption.material, partId);
                    console.log('RifleModel: Applied color override to mesh:', child.name);
                  }
                } else {
                  // Apply pattern
                  const patternOption = manifest.finishModes.patterns?.options?.find(
                    (option: any) => option.id === selectedPattern
                  );
                  if (patternOption) {
                    materialToApply = createMaterialFromDefinition(patternOption.material, partId);
                    console.log(`🎨 Pattern "${selectedPattern}" → ${partId} (${child.name})`);
                  }
                }
              } else if (finishMode === 'patterns' && !selectedPattern) {
                // 🔥 NEW: Patterns mode without pattern - use color customization or fallback
                const colorId = partColorOverrides[partId] || selectedColors[partId];
                if (colorId) {
                  const colorOption = manifest.finishModes.colors?.options?.find(
                    (option: any) => option.id === colorId
                  );
                  if (colorOption) {
                    materialToApply = createMaterialFromDefinition(colorOption.material, partId);
                    console.log(`🎨 Color customization "${colorId}" → ${partId} (${child.name})`);
                  }
                }
              } else if (finishMode === 'colors') {
                // Apply individual colors
                if (selectedColors[partId]) {
                  const colorOption = manifest.finishModes.colors?.options?.find(
                    (option: any) => option.id === selectedColors[partId]
                  );
                  if (colorOption) {
                    materialToApply = createMaterialFromDefinition(colorOption.material, partId);
                    console.log(`🎨 Color "${selectedColors[partId]}" → ${partId} (${child.name})`);
                  }
                }
              }
            } else {
              unmatchedMeshes.push(child.name);
            }
          }

          // Fallback to legacy system if flexible matching didn't find anything
          if (!shouldApplyMaterial) {
            // Use legacy getSelectedMaterials approach
            const materials = getSelectedMaterials();
            if (materials[child.name]) {
              shouldApplyMaterial = true;
              materialToApply = createMaterialFromDefinition(materials[child.name]);
              console.log('RifleModel: Applied legacy material to mesh:', child.name);
            }
          }

          // Apply material or use default
          if (shouldApplyMaterial && materialToApply) {
            // Force material update - handle both single and array materials
            if (Array.isArray(child.material)) {
              // If material is an array, update all materials in the array
              child.material = child.material.map(() => materialToApply.clone());
            } else {
              child.material = materialToApply;
            }
            
            // Apply red glow if this mesh belongs to the same part as hovered or selected mesh
            const partId = findPartForMesh(
              child.name,
              manifest.configurableParts || [],
              manifest
            );
            
            const shouldHighlight = (hoveredPartId && partId === hoveredPartId) || 
                                    (selectedPartId && partId === selectedPartId);

            if (shouldHighlight) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.emissive = new THREE.Color(0xBA2025); // CheyTac red
                  mat.emissiveIntensity = 0.4;
                });
              } else {
                child.material.emissive = new THREE.Color(0xBA2025); // CheyTac red
                child.material.emissiveIntensity = 0.4;
              }
            } else {
              // Clear any existing emissive
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.emissive = new THREE.Color(0x000000);
                  mat.emissiveIntensity = 0;
                });
              } else {
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
              }
            }
            
            // Force the material to update
            child.material.needsUpdate = true;
            
            // Only update UV if it exists
            if (child.geometry && child.geometry.attributes && child.geometry.attributes.uv) {
              child.geometry.attributes.uv.needsUpdate = true;
            }
          } else if (shouldApplyMaterial) {
            // Default material for configurable parts
            const defaultMaterial = new THREE.MeshStandardMaterial({
              color: '#666666',
              metalness: 0.3,
              roughness: 0.8,
            });
            
            if (Array.isArray(child.material)) {
              child.material = child.material.map(() => defaultMaterial.clone());
            } else {
              child.material = defaultMaterial;
            }
          }
        }
      });
      
      console.log('✓ Matched parts:', Array.from(matchedParts));
      if (unmatchedMeshes.length > 0) {
        console.log('⚠ Unmatched meshes (first 10):', unmatchedMeshes.slice(0, 10));
        console.log(`⚠ Total unmatched: ${unmatchedMeshes.length} (likely small hardware pieces)`);
      }
      console.log('=== Material Application Complete ===');
    }
  }, [finishMode, selectedPattern, selectedColors, partColorOverrides, manifest, stableScene, hoveredMesh, selectedMesh, selectedSuppressor]);

  return (
    <Center>
      <group 
        ref={modelRef} 
        scale={0.01}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <primitive object={stableScene} />
      </group>
    </Center>
  );
}

function LoadingFallback() {
  console.log('LoadingFallback: Showing loading placeholder');
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[0.5, 0.1, 0.1]} />
      <meshStandardMaterial color="#ffffff01" />
    </mesh>
  );
}

// Camera setup component to set initial position based on device type
function CameraSetup({ distance }: { distance: number }) {
  const { camera } = useThree();
  
  useEffect(() => {
    // Side profile view - positioned to the right side with better elevation
    camera.position.set(distance, distance * 0.3, distance * 0.2);
    camera.lookAt(0, 0.2, 0);  // Look slightly above center for better framing
    
    // Adjust near clipping plane to prevent seeing through model when zoomed in
    camera.near = 1.5;  // Increased from 0.5 to 1.5 to prevent more clipping
    camera.far = 2000;
    
    camera.updateProjectionMatrix();
    console.log('CameraSetup: Set initial camera to side profile view with adjusted clipping');
  }, [camera, distance]);
  
  return null;
}

export function TestModelViewer({ productPath, onLoadComplete }: { productPath: string; onLoadComplete?: () => void }) {
  const { getCurrentModelFile, selectedSuppressor } = useConfigStore();
  const modelFile = getCurrentModelFile();
  
  // Detect mobile device
  const isMobile = useMemo(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
           || window.innerWidth < 768;
  }, []);
  
  // Set camera distances based on device type
  const cameraDistances = useMemo(() => {
    if (isMobile) {
      return {
        min: 10,   // Increased to prevent clipping
        max: 25,
        default: 18
      };
    }
    return {
      min: 7,    // Increased to prevent clipping on desktop
      max: 15,
      default: 12
    };
  }, [isMobile]);
  
  console.log('TestModelViewer: Rendering with model file:', modelFile);
  console.log('TestModelViewer: Selected suppressor:', selectedSuppressor);
  console.log('TestModelViewer: Is mobile device:', isMobile);
  console.log('TestModelViewer: Camera distances:', cameraDistances);
  
  return (
    <>
      {/* Set initial camera position based on device */}
      <CameraSetup distance={cameraDistances.default} />
      
      <OrbitControls
        makeDefault
        minDistance={cameraDistances.min}
        maxDistance={cameraDistances.max}
        target={[0, 0, 0]}
        enableZoom={true}
        enablePan={true}
        panSpeed={0.3}
        enableRotate={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={(Math.PI * 5) / 6}
        enableDamping={true}
        dampingFactor={0.1}
      />
      
{/* Base ambient light */}
<ambientLight intensity={0.6} />

{/* Hemisphere for soft top/bottom fill */}
<hemisphereLight intensity={0.4} groundColor="#333333" />

{/* SYMMETRICAL KEY LIGHTS - One on each side */}
<directionalLight 
  position={[8, 5, 3]} 
  intensity={1.0} 
  castShadow 
  shadow-mapSize={[2048, 2048]}
/>
<directionalLight 
  position={[-8, 5, 3]} 
  intensity={1.0} 
/>

{/* SYMMETRICAL FILL LIGHTS - Front corners */}
<directionalLight position={[5, 3, 8]} intensity={0.7} />
<directionalLight position={[-5, 3, 8]} intensity={0.7} />

{/* SYMMETRICAL BACK LIGHTS - Rear corners */}
<directionalLight position={[5, 3, -8]} intensity={0.6} />
<directionalLight position={[-5, 3, -8]} intensity={0.6} />

{/* Bottom fill for underside */}
<directionalLight position={[0, -4, 0]} intensity={0.5} />

{/* Environment */}
<Environment preset="warehouse" background={false} environmentIntensity={0.5} />

{/* Shadow plane */}
<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
  <planeGeometry args={[50, 50]} />
  <shadowMaterial opacity={0.2} />
</mesh>
      
      <Suspense fallback={<LoadingFallback />} key={modelFile}>
        <RifleModel productPath={productPath} modelFile={modelFile} onLoadComplete={onLoadComplete} />
      </Suspense>
      
     </>
  );
}
// src/components/ModelViewer/TestModelViewer.tsx
import { useRef, useEffect, Suspense, useMemo } from 'react';
import { useGLTF, OrbitControls, Environment, ContactShadows, Center } from '@react-three/drei';
import { useConfigStore } from '../../state/useConfigStore';
import * as THREE from 'three';

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
  
  // Stock lock components
  "CT_1-004_Stock_Lock_Rev_4",
  "CT_1-005_Stock_Lock_Spring_1986K616",
  "CT_1-005_Stock_Lock_Spring_1986K617",
  "CT_1-006_Cover_Plate",
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
  "CT_1-013_Handle_Mount",
  "CT_1-014_Handle_Mount_Screw_91251A542",
  "CT_1-014_Handle_Mount_Screw_91251A543",
  
  // Bolt release components
  "CT_1-015_Bolt_Release",
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
  "CT_1-024_Mag_Release",
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
  "CT_2-006_Bolt_Handle_Base",
  "CT_2-006_Bolt_Handle_Shaft",
  "CT_2-007_Bolt_Handle_Knob",
  "CT_2-008_Bolt_Lock_Nut",
  "CT_2-009_Bolt_Cam",
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
  "CT_3-003_Barrel_Nut",
  "CT_3-005_Barrel_Alignment_Pin_90145A501",
  
  // Stock components
  "CT_4-002_Recoil_Pad_Screw_91251A342",
  "CT_4-002_Recoil_Pad_Screw_91251A343",
  "CT_4-003_Butt_Plate",
  "CT_4-004L_Stock_Rod_Left",
  "CT_4-004R_Stock_Rod_Right",
  "CT_4-005_Stock_Rod_Screw_91253A537",
  "CT_4-005_Stock_Rod_Screw_91253A538",
  "CT_4-006_Cheek_Piece_Bracket",
  "CT_4-007_Cheek_Piece_Bracket_Screw_91253A006",
  "CT_4-007_Cheek_Piece_Bracket_Screw_91253A007",
  "CT_4-009_Cheek_Piece_Retainer_2",
  "CT_4-009_Cheek_Piece_Retainer_Dowel_90145A506",
  "CT_4-010_Cheek_Piece_Screw_91255A267",
  "CT_4-010_Cheek_Piece_Screw_91255A268",
  "CT_4-011_Monopod_Leg",
  "CT_4-012_Monopod_Foot",
  "CT_4-013_Monopod_Screw_91251A541",
  "CT_4-014_Monopod_Spring_1986K59",
  "CT_4-015_Monopod_Retainer_Screw_91255A194",
  "CT_4-016_Stock_Rod_Spacer",
  
  // Hand guard clamp
  "CT_5-002_Hand_Guard_Clamp",
  "CT_5-003_Handguard_Clamp_Screw_91251A540",
  
  // Handle clamp screws
  "CT_5-006_Handle_Clamp_Screw_91251A535",
  "CT_5-006_Handle_Clamp_Screw_91251A536",
  "CT_5-006_Handle_Clamp_Screw_91251A537",
  "CT_5-006_Handle_Clamp_Screw_91251A538",
  
  // All Bipod components
  "CT_5-007-2_Bipod_Bracket",
  "CT_5-008-2_Bipod_Bracket_Screw_64835K067",
  "CT_5-008-2_Bipod_Bracket_Screw_64835K068", 
  "CT_5-008-2_Bipod_Bracket_Screw_64835K66",
  "CT_5-009-2_Swivel_Guide_Plate",
  "CT_5-009-2_Swivel_Guide_Plate001",
  "CT_5-010-2_Bipod_Inner_Leg",
  "CT_5-010-2_Bipod_Inner_Leg001",
  "CT_5-011-2_Bipod_Locking_Pin",
  "CT_5-011-2_Bipod_Locking_Pin001",
  "CT_5-012-2_Bipod_Locking_Pin_Spring_1986K751",
  "CT_5-012-2_Bipod_Locking_Pin_Spring_1986K752",
  "CT_5-013-2_Bipod_Locking_Pin_Release_Knob",
  "CT_5-013-2_Bipod_Locking_Pin_Release_Knob001",
  "CT_5-014-2_Swivel_Washer_92678A182",
  "CT_5-014-2_Swivel_Washer_92678A183",
  "CT_5-014-2_Swivel_Washer_92678A184",
  "CT_5-014-2_Swivel_Washer_92678A185",
  "CT_5-015_Bipod_Swivel_Screw_91259A619",
  "CT_5-015_Bipod_Swivel_Screw_91259A620",
  "CT_5-016-2_Bipod_Outer_Leg",
  "CT_5-016-2_Bipod_Outer_Leg001",
  "CT_5-017-2_Bipod_Foot_Adapter",
  "CT_5-017-2_Bipod_Foot_Adapter001",
  "CT_5-018-2_Bipod_Foot_Release_Housing",
  "CT_5-018-2_Bipod_Foot_Release_Housing001",
  "CT_5-019-2_Bipod_Foot_Release_Housing_Roll_Pin_92373A147",
  "CT_5-019-2_Bipod_Foot_Release_Housing_Roll_Pin_92373A148",
  "CT_5-020_Bipod_Foot_Release",
  "CT_5-020_Bipod_Foot_Release001",
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
  "Magazine_20_Base_Plate",
  
  // Clips and small parts
  "E_CLIP_125_97431A240STEP",
  "E_CLIP_125_97431A240STEP001",
  
  // Butt pad
  "Limbsaver_TRAP_GRIND_TO_FIT_Butt_Padstep",
  
  // Trigger guard
  "Trigger_Guard_2024",
  
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
  "SAREM700BBLSTEP",
  "TRREM700-2_BLACK_OXIDESTEP"
];

function RifleModel({ productPath }: { productPath: string }) {
  const modelRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(`${productPath}/product.glb`);
  const { getSelectedMaterials, selectedOptions } = useConfigStore();
  
  console.log('RifleModel: Loaded GLB successfully');
  
  // Create a stable scene copy that won't be re-cloned
  const stableScene = useMemo(() => {
    const clonedScene = scene.clone();
    console.log('RifleModel: Created stable scene clone');
    return clonedScene;
  }, [scene]);

  // Apply materials when selections change
  useEffect(() => {
    if (modelRef.current) {
      console.log('RifleModel: Applying materials for selections:', selectedOptions);
      const materials = getSelectedMaterials();
      console.log('RifleModel: Selected materials:', materials);
      
      // Apply materials to meshes
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Check if this part should be fixed black
          if (FIXED_BLACK_PARTS.includes(child.name)) {
            child.material = new THREE.MeshStandardMaterial({
              color: "#1a1a1a",
              metalness: 0.2,
              roughness: 0.8,
            });
            return; // Skip configurable material application
          }

          // Check each material selector from manifest
          Object.entries(materials).forEach(([selector, materialDef]) => {
            if (child.name === selector) {
              console.log('RifleModel: Applying material to mesh:', child.name, materialDef);
              
              // Create material from definition
              let material: THREE.MeshStandardMaterial;
              
              if (typeof materialDef === 'object' && 'color' in materialDef) {
                // Material object with properties
                material = new THREE.MeshStandardMaterial({
                  color: materialDef.color || '#666666',
                  metalness: materialDef.metalness ?? 0.1,
                  roughness: materialDef.roughness ?? 0.9,
                });
              } else if (typeof materialDef === 'string') {
                // Simple color string
                material = new THREE.MeshStandardMaterial({
                  color: materialDef,
                  metalness: 0.1,
                  roughness: 0.9,
                });
              } else {
                // Fallback
                material = new THREE.MeshStandardMaterial({
                  color: '#666666',
                  metalness: 0.1,
                  roughness: 0.9,
                });
              }
              
              child.material = material;
              console.log('RifleModel: Material applied successfully to:', child.name);
            }
          });
        }
      });
    }
  }, [selectedOptions, getSelectedMaterials]);

  // Enable shadows on all meshes
  useEffect(() => {
    if (modelRef.current) {
      console.log('RifleModel: Enabling shadows on all meshes');
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [stableScene]);

  // Log meshes for debugging
  useEffect(() => {
    if (stableScene) {
      console.log('RifleModel: Scanning scene for ALL meshes...');
      const allMeshes: string[] = [];
      stableScene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name) {
          allMeshes.push(child.name);
          console.log('Found Mesh:', child.name);
        }
      });
      console.log('\n=== COMPLETE MESH LIST ===');
      console.log('Total meshes found:', allMeshes.length);
      console.log('All mesh names:', JSON.stringify(allMeshes, null, 2));
      console.log('=========================\n');
    }
  }, [stableScene]);

  return (
    <Center>
      <group ref={modelRef} scale={0.01}>
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
      <meshStandardMaterial color="#fbbf24" />
    </mesh>
  );
}

export function TestModelViewer({ productPath }: { productPath: string }) {
  console.log('TestModelViewer: Rendering with material persistence fixes');
  
  return (
    <>
      <OrbitControls
        makeDefault
        minDistance={4}
        maxDistance={15}
        target={[0, 0, 0]}
        enableZoom={true}
        enablePan={false}
        minPolarAngle={Math.PI / 6}  // Prevent looking too far up
        maxPolarAngle={(Math.PI * 2) / 3}  // Prevent looking too far down
      />
      
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.8} 
        castShadow 
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 3, 5]} intensity={0.4} />
      
      <Environment preset="studio" background={false} />
      
      <Suspense fallback={<LoadingFallback />}>
        <RifleModel productPath={productPath} />
      </Suspense>
      
     <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
  <planeGeometry args={[20, 20]} />
  <shadowMaterial opacity={0.3} />
</mesh>
    </>
  );
}
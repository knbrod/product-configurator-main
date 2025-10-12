// src/components/Hotspot/ModalHotspot.tsx
import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useConfigStore } from '../../state/useConfigStore';
import * as THREE from 'three';

interface ClickableModelHotspotProps {
  gltf: any; // Your loaded GLTF model
}

// Dynamic tooltip positioning hook (keeping your existing one)
const useDynamicTooltip = () => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getTooltipStyle = (hotspotScreenX: number, hotspotScreenY: number) => {
    const { width, height, isMobile } = screenSize;
    
    if (isMobile) {
      if (hotspotScreenY < height * 0.5) {
        return {
          position: 'fixed' as const,
          bottom: '20px',
          left: '20px',
          transform: 'none'
        };
      } else {
        return {
          position: 'fixed' as const,
          top: '20px',
          left: '20px',
          transform: 'none'
        };
      }
    } else {
      const padding = 20;
      
      if (hotspotScreenX < width * 0.5) {
        return {
          position: 'fixed' as const,
          right: `${padding}px`,
          top: hotspotScreenY < height * 0.5 ? `${padding}px` : 'auto',
          bottom: hotspotScreenY >= height * 0.5 ? `${padding}px` : 'auto',
          transform: 'none'
        };
      } else {
        return {
          position: 'fixed' as const,
          left: `${padding}px`,
          top: hotspotScreenY < height * 0.5 ? `${padding}px` : 'auto',
          bottom: hotspotScreenY >= height * 0.5 ? `${padding}px` : 'auto',
          transform: 'none'
        };
      }
    }
  };

  return { getTooltipStyle, isMobile: screenSize.isMobile };
};

// Individual Clickable Mesh Component
function ClickableMeshHotspot({ 
  mesh, 
  partId, 
  title, 
  summary 
}: { 
  mesh: THREE.Mesh, 
  partId: string, 
  title: string, 
  summary?: string 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [screenPosition, setScreenPosition] = useState({ x: 0, y: 0 });
  const [originalMaterial, setOriginalMaterial] = useState<THREE.Material | null>(null);
  const { camera, gl } = useThree();
  const { getTooltipStyle, isMobile } = useDynamicTooltip();
  const { 
    setModalOpen,
    setModalPartId,
    activePartId,
    focusCameraOnPart
  } = useConfigStore();

  // Store original material
  useEffect(() => {
    if (mesh && mesh.material && !originalMaterial) {
      if (Array.isArray(mesh.material)) {
        setOriginalMaterial(mesh.material[0].clone());
      } else {
        setOriginalMaterial(mesh.material.clone());
      }
    }
  }, [mesh, originalMaterial]);

  // Handle hover effects and highlighting
  useFrame((state) => {
    if (!meshRef.current || !mesh) return;

    // Calculate screen position for tooltip
    if (hovered) {
      const worldPosition = new THREE.Vector3();
      mesh.getWorldPosition(worldPosition);
      worldPosition.project(camera);
      
      const x = (worldPosition.x * 0.5 + 0.5) * gl.domElement.clientWidth;
      const y = (worldPosition.y * -0.5 + 0.5) * gl.domElement.clientHeight;
      
      setScreenPosition({ x, y });
    }

    // Apply visual effects
    const isActive = activePartId === partId;
    
    if (mesh.material) {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      
      if (material instanceof THREE.MeshStandardMaterial) {
        if (hovered && !isActive) {
          // Hover effect - subtle highlight
          material.emissive.setHex(0x444444);
          material.emissiveIntensity = 0.2;
        } else if (isActive) {
          // Active/selected effect - stronger highlight
          material.emissive.setHex(0xba2025);
          material.emissiveIntensity = 0.4;
        } else {
          // Reset to normal
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
        }
      }
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    setHovered(false);
    setModalPartId(partId);
    setModalOpen(true);
    focusCameraOnPart(partId);
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    if (!isMobile) {
      setHovered(true);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'default';
  };

  // Copy mesh properties to our ref
  useEffect(() => {
    if (meshRef.current && mesh) {
      meshRef.current.geometry = mesh.geometry;
      meshRef.current.material = mesh.material;
      meshRef.current.position.copy(mesh.position);
      meshRef.current.rotation.copy(mesh.rotation);
      meshRef.current.scale.copy(mesh.scale);
    }
  }, [mesh]);

  const isActive = activePartId === partId;
  const tooltipStyle = hovered ? getTooltipStyle(screenPosition.x, screenPosition.y) : {};

  return (
    <>
      {/* Invisible clickable mesh overlay */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        geometry={mesh.geometry}
        material={mesh.material}
        position={mesh.position}
        rotation={mesh.rotation}
        scale={mesh.scale}
      />

      {/* Dynamic tooltip */}
      {hovered && (
        <Html fullscreen>
          <div 
            className="dynamic-hotspot-tooltip"
            style={{
              ...tooltipStyle,
              zIndex: 1000,
              pointerEvents: 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <div className="tooltip-content">
              <div className="tooltip-title">{title}</div>
              {summary && <div className="tooltip-summary">{summary}</div>}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}

// Helper function to get material color (keeping your existing one)
function getMaterialColor(material: any): string {
  if (material && typeof material === 'object') {
    if ('color' in material) {
      return material.color;
    }
    if ('pbrMetallicRoughness' in material && material.pbrMetallicRoughness.baseColor) {
      return material.pbrMetallicRoughness.baseColor;
    }
  }
  return '#666';
}

// Configuration Modal Component (keeping your existing one)
function ConfigurationModal() {
  const { 
    modalOpen,
    modalPartId,
    manifest,
    selectedOptions,
    setModalOpen,
    selectOption,
    getPartUIGroup
  } = useConfigStore();

  if (!modalOpen || !modalPartId || !manifest) return null;

  const part = manifest.parts.find(p => p.id === modalPartId);
  if (!part) return null;

  const uiGroup = getPartUIGroup(modalPartId);
  const currentSelection = selectedOptions[modalPartId];

  const handleOptionSelect = (optionId: string) => {
    selectOption(modalPartId, optionId);
  };

  const handleClose = () => {
    setModalOpen(false);
  };

  const handleConfirm = () => {
    setModalOpen(false);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="configuration-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={handleClose}>×</button>
        
        <div className="modal-header">
          <h2 className="modal-title">CONFIGURATION OPTIONS</h2>
        </div>

        <div className="part-title-section">
          <div className="part-title">{part.label.toUpperCase()}</div>
        </div>

        <div className="modal-content">
          <div className="config-group">
            <div className="group-header">
              <h3 className="group-title">{uiGroup?.label || 'Options'}</h3>
              <span className="expand-icon">▼</span>
            </div>
            
            <div className="options-list">
              {part.options.map(option => (
                <div
                  key={option.id}
                  className={`option-row ${currentSelection === option.id ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(option.id)}
                >
                  <div className="option-content">
                    <div className="option-label">{option.label}</div>
                    <div 
                      className="option-swatch"
                      style={{ 
                        backgroundColor: getMaterialColor(option.material)
                      }}
                    />
                  </div>
                  {currentSelection === option.id && (
                    <div className="selected-indicator">✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.2)'
        }}>
          <button 
            onClick={handleConfirm}
            style={{
              padding: '12px 48px',
              backgroundColor: '#BA2025',
              border: '2px solid #BA2025',
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            CONFIRM SELECTION
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Clickable Model Hotspots Component
export function ClickableModelHotspot({ gltf }: ClickableModelHotspotProps) {
  const { computedHotspots, manifest } = useConfigStore();
  const [clickableMeshes, setClickableMeshes] = useState<Array<{
    mesh: THREE.Mesh;
    partId: string;
    title: string;
    summary?: string;
  }>>([]);

  // Find meshes that correspond to hotspots
  useEffect(() => {
    if (!gltf || !gltf.scene || !computedHotspots || !manifest) return;

    const meshes: Array<{
      mesh: THREE.Mesh;
      partId: string;
      title: string;
      summary?: string;
    }> = [];

    // For each hotspot, find the corresponding mesh(es)
    computedHotspots.forEach(hotspot => {
      const part = manifest.parts.find(p => p.id === hotspot.partId);
      if (!part || !part.meshSelectors) return;

      // Find meshes that match the part's mesh selectors
      gltf.scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          const meshMatches = part.meshSelectors.some(selector => 
            child.name.includes(selector) || 
            child.name === selector ||
            child.name.toLowerCase().includes(selector.toLowerCase())
          );

          if (meshMatches) {
            meshes.push({
              mesh: child,
              partId: hotspot.partId,
              title: hotspot.title,
              summary: hotspot.summary
            });
          }
        }
      });
    });

    console.log('Found clickable meshes:', meshes.map(m => ({ name: m.mesh.name, partId: m.partId })));
    setClickableMeshes(meshes);
  }, [gltf, computedHotspots, manifest]);

  return (
    <>
      {/* Render the original model */}
      {gltf && <primitive object={gltf.scene} />}
      
      {/* Render clickable mesh overlays */}
      <group>
        {clickableMeshes.map((item, index) => (
          <ClickableMeshHotspot
            key={`${item.partId}-${index}`}
            mesh={item.mesh}
            partId={item.partId}
            title={item.title}
            summary={item.summary}
          />
        ))}
      </group>
      
      {/* Configuration Modal */}
      <Html fullscreen>
        <ConfigurationModal />
      </Html>
    </>
  );
}

export { ConfigurationModal };
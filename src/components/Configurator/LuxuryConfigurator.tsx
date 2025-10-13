// src/components/Configurator/LuxuryConfigurator.tsx
import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useConfigStore } from '../../state/useConfigStore';
import * as THREE from 'three';

interface LuxuryHotspotProps {
  partId: string;
  position: [number, number, number];
  title: string;
  description?: string;
}

// Premium Hotspot Component
function LuxuryHotspot({ partId, position, title, description }: LuxuryHotspotProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<[number, number, number]>([0, 0.5, 0]);
  const { camera, gl } = useThree();
  const { 
    setModalOpen,
    setModalPartId,
    focusCameraOnPart,
    hideHotspots
  } = useConfigStore();

  // Hide hotspot during export
  if (hideHotspots) return null;

  // Calculate tooltip position based on screen position
  useFrame(() => {
    if (meshRef.current) {
      // Very subtle floating
      meshRef.current.position.y = position[1] + Math.sin(Date.now() * 0.0015) * 0.01;
      // Face camera
      meshRef.current.lookAt(camera.position);
      // Gentle scale animation when hovered
      const targetScale = hovered ? 1.1 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

      // Dynamic tooltip positioning
      if (hovered) {
        const worldPosition = new THREE.Vector3();
        meshRef.current.getWorldPosition(worldPosition);
        worldPosition.project(camera);
        
        // Calculate screen Y position (0 = bottom, 1 = top)
        const screenY = worldPosition.y * -0.5 + 0.5;
        
        // If hotspot is in top half of screen, tooltip goes down
        // If hotspot is in bottom half, tooltip goes up
        if (screenY < 0.5) {
          setTooltipPosition([0, -0.5, 0]); // Below hotspot
        } else {
          setTooltipPosition([0, 0.8, 0]); // Above hotspot
        }
      }
    }
  });

  const handleClick = () => {
    console.log('Hotspot clicked!', partId);
    console.log('Store methods:', { setModalOpen, setModalPartId, focusCameraOnPart });
    
    setModalPartId(partId);
    setModalOpen(true);
    focusCameraOnPart(partId);
  };

  return (
    <group position={position}>
      {/* Elegant hotspot indicator */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <circleGeometry args={[0.08, 32]} />
        <meshBasicMaterial 
          color={hovered ? "#BA2025" : "#ffffff"}
          transparent
          opacity={hovered ? 0.95 : 0.85}
          toneMapped={false}
        />
      </mesh>

      {/* Premium tooltip */}
      {hovered && (
        <Html
          position={tooltipPosition}
          center
          distanceFactor={12}
          className="pointer-events-none"
        >
          <div className="luxury-tooltip">
            <div className="tooltip-title">{title}</div>
            {description && <div className="tooltip-desc">{description}</div>}
          </div>
        </Html>
      )}
    </group>
  );
}

// Luxury Configuration Modal
function LuxuryConfigModal() {
  const { 
    modalOpen,
    modalPartId,
    manifest,
    finishMode,
    selectedColors,
    selectedPattern,
    selectedOptions,
    partColorOverrides,
    setModalOpen,
    selectOption,
    selectPartColor,
    selectPattern,
    setFinishMode,
    clearPartColorOverride,
    getPartUIGroup
  } = useConfigStore();

  // Local state for pattern mode: show patterns or show color overrides
  const [showingOverride, setShowingOverride] = useState(false);

  // Debug logging
  console.log('Modal state:', { modalOpen, modalPartId, manifest: !!manifest, finishMode });

  if (!modalOpen || !modalPartId || !manifest) return null;

  const part = manifest.parts.find(p => p.id === modalPartId);
  if (!part) return null;

  const uiGroup = getPartUIGroup(modalPartId);
  
  // Check if this part has a color override in pattern mode
  const hasColorOverride = finishMode === 'patterns' && partColorOverrides[modalPartId];

  // Get available options based on what we're showing
  const getAvailableOptions = () => {
    if (manifest.finishModes && finishMode === 'patterns') {
      if (showingOverride) {
        // Show colors for override
        return manifest.finishModes.colors.options || [];
      } else {
        // Show patterns for whole rifle
        return manifest.finishModes.patterns.options || [];
      }
    }
    
    if (manifest.finishModes && finishMode === 'colors') {
      // For colors mode, show color options
      return manifest.finishModes.colors.options || [];
    }
    
    // Fall back to legacy system
    if (part.options) {
      return part.options;
    }
    
    // No options available
    return [];
  };

  const availableOptions = getAvailableOptions();

  // Get current selection
  const getCurrentSelection = () => {
    if (manifest.finishModes && finishMode === 'patterns') {
      if (showingOverride) {
        // Show color override selection
        return partColorOverrides[modalPartId] || null;
      } else {
        // Show pattern selection
        return selectedPattern;
      }
    }
    if (manifest.finishModes && finishMode === 'colors') {
      return selectedColors[modalPartId];
    }
    return selectedOptions[modalPartId];
  };

  const currentSelection = getCurrentSelection();

  const handleOptionSelect = (optionId: string) => {
    console.log('Option selected:', { optionId, finishMode, showingOverride, modalPartId });
    
    if (manifest.finishModes && finishMode === 'patterns') {
      if (showingOverride) {
        // Set color override for this part
        console.log('Setting color override for part:', modalPartId, 'color:', optionId);
        selectPartColor(modalPartId, optionId);
      } else {
        // Select pattern for whole rifle
        console.log('Selecting pattern for whole rifle:', optionId);
        selectPattern(optionId);
      }
    } else if (manifest.finishModes && finishMode === 'colors') {
      // For colors, apply to specific part
      console.log('Selecting color for part:', modalPartId, 'color:', optionId);
      selectPartColor(modalPartId, optionId);
    } else {
      // Legacy system
      selectOption(modalPartId, optionId);
    }
  };

  const handleResetToPattern = () => {
    clearPartColorOverride(modalPartId);
    setShowingOverride(false);
  };

  const handleClose = () => {
    setModalOpen(false);
    setShowingOverride(false);
  };

  // Get material color helper
  const getMaterialColor = (material: any): string => {
    if (material && typeof material === 'object') {
      // New system
      if (material.type === 'color' && material.color) {
        return material.color;
      }
      // Legacy system
      if ('color' in material) return material.color;
      if ('pbrMetallicRoughness' in material && material.pbrMetallicRoughness.baseColor) {
        return material.pbrMetallicRoughness.baseColor;
      }
    }
    return '#666';
  };

  // If no options available, show message
  if (availableOptions.length === 0) {
    return (
      <div 
        className="luxury-modal-overlay" 
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}
      >
        <div 
          className="luxury-modal" 
          onClick={e => e.stopPropagation()}
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            color: 'white',
            border: '2px solid #BA2025',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
            {part.label}
          </div>
          <div style={{ marginBottom: '20px', color: '#ccc' }}>
            No configuration options available for this part.
          </div>
          <button 
            onClick={handleClose}
            style={{
              padding: '12px 24px',
              backgroundColor: '#BA2025',
              border: '2px solid #BA2025',
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="luxury-modal-overlay" 
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div 
        className="luxury-modal" 
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          color: 'white',
          border: '2px solid #BA2025'
        }}
      >
        
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          borderBottom: '2px solid #BA2025',
          paddingBottom: '15px'
        }}>
          <div>
            <div style={{ fontSize: '14px', color: '#BA2025', fontWeight: 'bold' }}>CheyTac USA</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
              {part.label}
            </div>
            {finishMode === 'patterns' && hasColorOverride && (
              <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '4px' }}>
                ✓ Color Override Active
              </div>
            )}
          </div>
          <button 
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Mode Toggle Buttons */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setFinishMode('colors')}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: finishMode === 'colors' ? '#BA2025' : 'transparent',
              color: finishMode === 'colors' ? 'white' : '#ccc',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
          >
            Colors
          </button>
          <button
            onClick={() => setFinishMode('patterns')}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: finishMode === 'patterns' ? '#BA2025' : 'transparent',
              color: finishMode === 'patterns' ? 'white' : '#ccc',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
          >
            Patterns
          </button>
        </div>

        {/* Pattern Mode: Toggle between Pattern selection and Color override */}
        {finishMode === 'patterns' && (
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '4px',
            marginBottom: '15px'
          }}>
            <button
              onClick={() => setShowingOverride(false)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: !showingOverride ? 'rgba(186, 32, 37, 0.3)' : 'transparent',
                color: !showingOverride ? 'white' : '#888',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s ease'
              }}
            >
              Rifle Pattern
            </button>
            <button
              onClick={() => setShowingOverride(true)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: showingOverride ? 'rgba(186, 32, 37, 0.3)' : 'transparent',
                color: showingOverride ? 'white' : '#888',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s ease'
              }}
            >
              Override Part
            </button>
          </div>
        )}

        {/* Info Banner */}
        {finishMode === 'patterns' && showingOverride && (
          <div style={{
            backgroundColor: 'rgba(186, 32, 37, 0.2)',
            border: '1px solid #BA2025',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '15px',
            fontSize: '13px',
            color: '#ccc'
          }}>
            💡 Select a color to override the pattern for <strong>{part.label}</strong> only
          </div>
        )}

        {/* Configuration Section */}
        <div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: 'white' }}>
            {finishMode === 'patterns' 
              ? (showingOverride ? `Override ${part.label}` : 'Select Pattern')
              : 'Available Colors'
            } ({availableOptions.length})
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
            {availableOptions.map(option => (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px',
                  backgroundColor: currentSelection === option.id ? '#BA2025' : 'rgba(255,255,255,0.1)',
                  border: `2px solid ${currentSelection === option.id ? '#BA2025' : 'transparent'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Preview */}
                {option.material?.type === 'texture' && option.thumbnail ? (
                  <img
                    src={option.thumbnail}
                    alt={option.label}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '4px',
                      marginRight: '15px',
                      objectFit: 'cover',
                      border: '2px solid rgba(255,255,255,0.3)'
                    }}
                  />
                ) : (
                  <div 
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%',
                      backgroundColor: getMaterialColor(option.material),
                      marginRight: '15px',
                      border: '2px solid rgba(255,255,255,0.3)'
                    }}
                  />
                )}
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: 'white' }}>{option.label}</div>
                </div>
                {currentSelection === option.id && (
                  <div style={{ color: 'white', fontSize: '20px' }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          gap: '10px',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0
        }}>
          {/* Reset to Pattern button - only show if part has color override */}
          {hasColorOverride && (
            <button 
              onClick={handleResetToPattern}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                border: '2px solid #BA2025',
                color: '#BA2025',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              Reset to Pattern
            </button>
          )}
          
          <button 
            onClick={handleClose}
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
            Confirm
          </button>
        </div>

      </div>
    </div>
  );
}

// Main Luxury Configurator Component
function LuxuryConfigurator() {
  const { computedHotspots, manifest } = useConfigStore();
  
  console.log('LuxuryConfigurator render:', { 
    hotspotsCount: computedHotspots?.length, 
    hasManifest: !!manifest 
  });
  
  return (
    <>
      {/* Premium Hotspots */}
      <group>
        {computedHotspots.map((hotspot) => (
          <LuxuryHotspot
            key={hotspot.partId}
            partId={hotspot.partId}
            position={[hotspot.position.x, hotspot.position.y, hotspot.position.z]}
            title={hotspot.title}
            description={hotspot.summary}
          />
        ))}
      </group>
    </>
  );
}

// Export both components
export { LuxuryConfigurator, LuxuryConfigModal };
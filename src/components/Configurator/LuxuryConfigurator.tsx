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
    selectedCaliber,
    selectedSuppressor,
    selectedTrigger,
    setModalOpen,
    selectOption,
    selectPartColor,
    selectPattern,
    setFinishMode,
    clearPartColorOverride,
    applyColorToAllParts,
    getPartUIGroup,
    selectCaliber,
    selectSuppressor
  } = useConfigStore();

  // Local state for pattern mode: show patterns or show color overrides
  const [showingOverride, setShowingOverride] = useState(false);

  // Debug logging
  console.log('Modal state:', { modalOpen, modalPartId, manifest: !!manifest, finishMode });

  if (!modalOpen || !modalPartId || !manifest) return null;

  const part = manifest.parts.find(p => p.id === modalPartId);
  if (!part) return null;

  const uiGroup = getPartUIGroup(modalPartId);
  
  // Check if this part has caliber options
  const hasCaliber = part.hasCaliber && manifest.calibers;
  
  // Check if this part has suppressor options
  const hasSuppressor = part.hasSuppressor && manifest.suppressors;
  
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
      // In colors mode, show if this color is selected for ALL parts
      const firstColor = selectedColors[Object.keys(selectedColors)[0]];
      const allSameColor = Object.values(selectedColors).every(color => color === firstColor);
      return allSameColor ? firstColor : null;
    }
    return selectedOptions[modalPartId];
  };

  const currentSelection = getCurrentSelection();

  // Handler functions
  const handleOptionSelect = (optionId: string) => {
    console.log('Option selected:', { optionId, finishMode, showingOverride, modalPartId });
    
    if (finishMode === 'colors') {
      // Colors mode: Apply to ALL parts globally
      console.log('Applying color globally to all parts:', optionId);
      applyColorToAllParts(optionId);
    } else if (finishMode === 'patterns') {
      if (showingOverride) {
        // Pattern mode + Color Customization: Set color override for this specific part
        console.log('Setting color override for part:', modalPartId, 'color:', optionId);
        selectPartColor(modalPartId, optionId);
      } else {
        // Pattern mode + Rifle Pattern: Select pattern for whole rifle
        console.log('Selecting pattern for whole rifle:', optionId);
        selectPattern(optionId);
      }
    } else {
      // Legacy system fallback
      selectOption(modalPartId, optionId);
    }
  };

  const handleCaliberSelect = (caliberId: string) => {
    console.log('Caliber selected:', caliberId);
    selectCaliber(caliberId);
  };

  const handleSuppressorSelect = (suppressorId: string) => {
    console.log('Suppressor selected:', suppressorId);
    selectSuppressor(suppressorId);
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

  // If no options available and no caliber and no suppressor, show message
  if (availableOptions.length === 0 && !hasCaliber && !hasSuppressor && !(modalPartId === 'triggerAssembly' && manifest.triggers)) {
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
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div 
        className="luxury-modal" 
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          color: 'white',
          border: '2px solid #BA2025',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        
        {/* Header - FIXED */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '24px 24px 20px',
          borderBottom: '2px solid #BA2025',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '14px', color: '#BA2025', fontWeight: 'bold' }}>CheyTac USA</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
              {part.label}
            </div>
            {finishMode === 'patterns' && hasColorOverride && (
              <div style={{ fontSize: '12px', color: '#ba2025', marginTop: '4px' }}>
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

        {/* Scrollable Content Area */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
          
          {/* CALIBER SELECTION - Only for barrel */}
          {hasCaliber && manifest.calibers && (
            <>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>
                Select Caliber
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {manifest.calibers.map(caliber => (
                  <div
                    key={caliber.id}
                    onClick={() => handleCaliberSelect(caliber.id)}
                    style={{
                      padding: '16px',
                      backgroundColor: selectedCaliber === caliber.id ? '#BA2025' : 'rgba(255,255,255,0.1)',
                      border: `2px solid ${selectedCaliber === caliber.id ? '#BA2025' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '18px',
                        color: 'white' 
                      }}>
                        {caliber.label}
                      </div>
                      {selectedCaliber === caliber.id && (
                        <div style={{ color: 'white', fontSize: '20px' }}>✓</div>
                      )}
                    </div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#ccc',
                      marginBottom: '8px'
                    }}>
                      {caliber.description}
                    </div>
                    {caliber.specifications && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#999',
                        display: 'flex',
                        gap: '15px',
                        flexWrap: 'wrap'
                      }}>
                        <span>• {caliber.specifications.bulletWeight}</span>
                        <span>• {caliber.specifications.muzzleVelocity}</span>
                        <span>• {caliber.specifications.energy}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{
                height: '1px',
                background: 'rgba(255,255,255,0.2)',
                margin: '10px 0'
              }} />
            </>
          )}

          {/* SUPPRESSOR SELECTION - Only for muzzle device */}
          {hasSuppressor && manifest.suppressors && (
            <>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>
                Select Suppressor Configuration
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {manifest.suppressors.map(suppressor => (
                  <div
                    key={suppressor.id}
                    onClick={() => handleSuppressorSelect(suppressor.id)}
                    style={{
                      padding: '16px',
                      backgroundColor: selectedSuppressor === suppressor.id ? '#BA2025' : 'rgba(255,255,255,0.1)',
                      border: `2px solid ${selectedSuppressor === suppressor.id ? '#BA2025' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '18px',
                        color: 'white' 
                      }}>
                        {suppressor.label}
                      </div>
                      {selectedSuppressor === suppressor.id && (
                        <div style={{ color: 'white', fontSize: '20px' }}>✓</div>
                      )}
                    </div>
                    {suppressor.description && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#ccc'
                      }}>
                        {suppressor.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{
                height: '1px',
                background: 'rgba(255,255,255,0.2)',
                margin: '10px 0'
              }} />
            </>
          )}

          {/* TRIGGER SELECTION - ONLY for triggerAssembly */}
          {modalPartId === 'triggerAssembly' && manifest.triggers && (
            <>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>
                Select Trigger
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {manifest.triggers.map(trigger => {
                  const selectTrigger = useConfigStore.getState().selectTrigger;
                  
                  return (
                    <div
                      key={trigger.id}
                      onClick={() => selectTrigger(trigger.id)}
                      style={{
                        padding: '16px',
                        backgroundColor: selectedTrigger === trigger.id ? '#BA2025' : 'rgba(255,255,255,0.1)',
                        border: `2px solid ${selectedTrigger === trigger.id ? '#BA2025' : 'transparent'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '16px',
                          color: 'white',
                          flex: 1
                        }}>
                          {trigger.label}
                        </div>
                        {selectedTrigger === trigger.id && (
                          <div style={{ color: 'white', fontSize: '20px' }}>✓</div>
                        )}
                      </div>
                      {trigger.description && (
                        <div style={{ 
                          fontSize: '13px', 
                          color: '#ccc'
                        }}>
                          {trigger.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div style={{
                height: '1px',
                background: 'rgba(255,255,255,0.2)',
                margin: '10px 0'
              }} />
            </>
          )}

          {/* MAIN MODE TOGGLE - Colors vs Patterns - Only show for configurable parts */}
          {modalPartId !== 'triggerAssembly' && (
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '4px'
            }}>
              <button
                onClick={() => {
                  setFinishMode('colors');
                  setShowingOverride(false);
                }}
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
                onClick={() => {
                  setFinishMode('patterns');
                  setShowingOverride(false);
                }}
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
          )}

          {/* Pattern Mode: Toggle between Pattern selection and Color override */}
          {modalPartId !== 'triggerAssembly' && finishMode === 'patterns' && (
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '4px'
            }}>
              <button
                onClick={() => setShowingOverride(false)}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: !showingOverride ? '#ba2025df' : 'transparent',
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
                  backgroundColor: showingOverride ? '#ba2025df' : 'transparent',
                  color: showingOverride ? 'white' : '#888',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  transition: 'all 0.2s ease'
                }}
              >
              Color Customization
              </button>
            </div>
          )}

          {/* Info Banner for Colors Mode */}
          {modalPartId !== 'triggerAssembly' && finishMode === 'colors' && (
            <div style={{
              backgroundColor: 'rgba(186, 32, 37, 0.2)',
              border: '1px solid rgba(186, 32, 37, 0.5)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '13px',
              color: '#ccc'
            }}>
              Select a color to apply to <strong>all configurable parts</strong>
            </div>
          )}

          {/* Info Banner for Pattern Mode - Color Customization */}
          {modalPartId !== 'triggerAssembly' && finishMode === 'patterns' && showingOverride && (
            <div style={{
              backgroundColor: 'rgba(186, 32, 37, 0.2)',
              border: '1px solid rgba(186, 32, 37, 0.5)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '13px',
              color: '#ccc'
            }}>
              Select a color to accent the pattern for <strong>{part.label}</strong> only
            </div>
          )}

          {/* Configuration Section Title - Only show for configurable parts */}
          {modalPartId !== 'triggerAssembly' && availableOptions.length > 0 && (
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>
              {finishMode === 'colors' 
                ? 'Available Colors'
                : (showingOverride ? `Customize ${part.label}` : 'Select Pattern')
              }
            </div>
          )}
          
          {/* Options List - Scrollable - Only show for configurable parts */}
          {modalPartId !== 'triggerAssembly' && availableOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
          )}
        </div>

        {/* Footer - FIXED AT BOTTOM */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          gap: '10px',
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
          backgroundColor: '#1a1a1a'
        }}>
          {/* Reset to Default button - always visible for all configurable parts */}
          {modalPartId !== 'triggerAssembly' && (
            <button 
              onClick={() => {
                const { reset } = useConfigStore.getState();
                reset();
                handleClose();
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                border: '2px solid #BA2025',
                color: '#BA2025',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(186, 32, 37, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Reset to Default
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
              fontSize: '14px',
              marginLeft: modalPartId === 'triggerAssembly' ? 'auto' : '0'
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
      {/* Hotspots disabled - using direct part clicking with red glow instead */}
      {/* 
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
      */}
    </>
  );
}

// Export both components
export { LuxuryConfigurator, LuxuryConfigModal };
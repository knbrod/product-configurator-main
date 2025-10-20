// src/state/useConfigStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProductManifest, Hotspot } from '../utils/manifestValidator';
import { generateConfigId } from '../utils/id';

export type CameraPreset = 'hero' | 'profile' | 'detail';
export type FinishMode = 'colors' | 'patterns';

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface ConfigState {
  // Product data
  manifest: ProductManifest | null;
  productPath: string | null;
  
  // Finish system
  finishMode: FinishMode;
  selectedPattern: string | null;  // For pattern mode
  selectedColors: Record<string, string>; // partId -> colorId (for color mode)
  partColorOverrides: Record<string, string>; // partId -> colorId (overrides pattern with color)
  
  // Caliber selection
  selectedCaliber: string | null; // caliberId
  
  // Suppressor selection
  selectedSuppressor: string | null; // suppressorId
  
  // Trigger selection
  selectedTrigger: string | null; // triggerId
  
  // Legacy selection state (for backward compatibility)
  selectedOptions: Record<string, string>; // partId -> optionId
  activePartId: string | null;
  activeGroupId: string | null;
  
  // UI state
  isConfigMenuOpen: boolean;
  isCinemaMode: boolean;
  isConfirmationMode: boolean;
  qualityMode: 'high' | 'low';
  hideHotspots: boolean; // For hiding hotspots during export
  
  // Configuration Panel state (OLD)
  configPanelOpen: boolean;
  configPanelPartId: string | null;
  
  // Modal state (NEW)
  modalOpen: boolean;
  modalPartId: string | null;
  
  // Camera state
  cameraPreset: CameraPreset;
  customCameraState: CameraState | null;
  
  // Hotspots
  computedHotspots: Hotspot[];
  
  // Configuration
  configId: string;
  
  // Actions
  loadManifest: (manifest: ProductManifest, productPath: string) => void;
  
  // Finish mode actions
  setFinishMode: (mode: FinishMode) => void;
  selectPattern: (patternId: string) => void;
  selectPartColor: (partId: string, colorId: string) => void;
  applyColorToAllParts: (colorId: string) => void;
  setPartColorOverride: (partId: string, colorId: string | null) => void;
  clearPartColorOverride: (partId: string) => void;
  
  // Caliber action
  selectCaliber: (caliberId: string) => void;
  
  // Suppressor action
  selectSuppressor: (suppressorId: string) => void;
  
  // Trigger action
  selectTrigger: (triggerId: string) => void;
  
  // Get current model file path
  getCurrentModelFile: () => string;
  
  // Legacy actions (for backward compatibility)
  selectOption: (partId: string, optionId: string) => void;
  setActivePart: (partId: string | null) => void;
  setActiveGroup: (groupId: string | null) => void;
  
  toggleConfigMenu: () => void;
  setCinemaMode: (enabled: boolean) => void;
  setConfirmationMode: (enabled: boolean) => void;
  setQualityMode: (mode: 'high' | 'low') => void;
  setHideHotspots: (hide: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setCustomCameraState: (state: CameraState | null) => void;
  updateHotspot: (partId: string, position: [number, number, number]) => void;
  reset: () => void;
  generateNewConfigId: () => void;
  getSelectedMaterials: () => Record<string, any>;
  getConfigurationPayload: () => object;
  
  // Configuration Panel actions (OLD)
  setConfigPanelOpen: (open: boolean) => void;
  setConfigPanelPartId: (partId: string | null) => void;
  updateConfiguration: (partId: string, optionId: string) => void;
  
  // Modal actions (NEW)
  setModalOpen: (open: boolean) => void;
  setModalPartId: (partId: string | null) => void;
  focusCameraOnPart: (partId: string) => void;
  getPartUIGroup: (partId: string) => any;
}

const defaultCameraState: CameraState = {
  position: [5, 2, 8],
  target: [0, 0, 0],
  fov: 50,
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // Initial state
      manifest: null,
      productPath: null,
      
      // Finish system
      finishMode: 'colors',
      selectedPattern: null,
      selectedColors: {},
      partColorOverrides: {},
      
      // Caliber
      selectedCaliber: null,
      
      // Suppressor
      selectedSuppressor: null,
      
      // Trigger
      selectedTrigger: null,
      
      // Legacy state
      selectedOptions: {},
      activePartId: null,
      activeGroupId: null,
      
      isConfigMenuOpen: true,
      isCinemaMode: false,
      isConfirmationMode: false,
      qualityMode: 'high',
      hideHotspots: false,
      cameraPreset: 'hero',
      customCameraState: null,
      computedHotspots: [],
      configId: generateConfigId(),
      
      // Configuration Panel state (OLD)
      configPanelOpen: false,
      configPanelPartId: null,
      
      // Modal state (NEW)
      modalOpen: false,
      modalPartId: null,

      // Actions
      loadManifest: (manifest, productPath) => {
        const defaultColors: Record<string, string> = {};
        
        // Set first color option as default for each configurable part
        const configurableParts = manifest.configurableParts || [];
        const firstColorOption = manifest.finishModes?.colors?.options?.[0];
        
        if (firstColorOption) {
          configurableParts.forEach(partId => {
            defaultColors[partId] = firstColorOption.id;
          });
        }

        // Set default caliber (prefer .408)
        const defaultCaliber = manifest.calibers?.find(c => c.id === '408-cheytac') || manifest.calibers?.[0];

        // Set default suppressor (prefer M3)
        const defaultSuppressor = manifest.suppressors?.find(s => s.id === 'm3-suppressor') || manifest.suppressors?.[0];

        // Set default trigger (prefer Elite Hunter Curved)
        const defaultTrigger = manifest.triggers?.find(t => t.id === 'timney-elite-curved') || manifest.triggers?.[0];

        // Legacy compatibility - set default options for each part
        const defaultOptions: Record<string, string> = {};
        manifest.parts.forEach(part => {
          if (part.options && part.options.length > 0) {
            defaultOptions[part.id] = part.options[0].id;
          }
        });

        set({
          manifest,
          productPath,
          selectedColors: defaultColors,
          selectedCaliber: defaultCaliber?.id || null,
          selectedSuppressor: defaultSuppressor?.id || null,
          selectedTrigger: defaultTrigger?.id || null,
          selectedOptions: defaultOptions,
          computedHotspots: manifest.hotspots,
          configId: generateConfigId(),
          finishMode: 'colors',
          selectedPattern: null,
          partColorOverrides: {},
        });
      },

      // Finish mode actions
      setFinishMode: (mode: FinishMode) => {
        console.log('Setting finish mode to:', mode);
        const { selectedColors } = get();
        
        const updates: any = { 
          finishMode: mode,
          configId: generateConfigId(),
        };
        
        if (mode === 'patterns') {
          // When switching to patterns mode, DON'T clear overrides
          // This preserves any color customizations already made
          console.log('📋 Switching to patterns mode, preserving any existing customizations');
        } else if (mode === 'colors') {
          // When switching to colors mode, clear pattern overrides
          console.log('🧹 Clearing all pattern overrides when switching to colors mode');
          updates.partColorOverrides = {};
        }
        
        set(updates);
      },

      selectPattern: (patternId: string) => {
        console.log('Selecting pattern:', patternId);
        
        // Clear overrides when selecting a new pattern
        // This gives a clean slate for each pattern
        set({ 
          selectedPattern: patternId,
          finishMode: 'patterns',
          partColorOverrides: {}, // Clear old overrides
          configId: generateConfigId(),
        });
      },

      selectPartColor: (partId: string, colorId: string) => {
        console.log('Selecting color for part:', partId, 'color:', colorId);
        const { selectedColors, finishMode } = get();
        
        // If in pattern mode, this is an override
        if (finishMode === 'patterns') {
          console.log('🚀 In pattern mode, calling setPartColorOverride');
          get().setPartColorOverride(partId, colorId);
          return;
        }
        
        // Otherwise, normal color mode behavior
        const newColors = { ...selectedColors, [partId]: colorId };
        
        // Auto-sync carry handle with handle clamp
        if (partId === 'carryHandle') {
          newColors.handleClamp = colorId;
          console.log('Auto-synced handle clamp to match carry handle:', colorId);
        } else if (partId === 'handleClamp') {
          newColors.carryHandle = colorId;
          console.log('Auto-synced carry handle to match handle clamp:', colorId);
        }
        
        set({ 
          selectedColors: newColors,
          finishMode: 'colors',
          configId: generateConfigId(),
        });
      },

      applyColorToAllParts: (colorId: string) => {
        console.log('Applying color to all parts:', colorId);
        const { manifest } = get();
        if (!manifest) return;

        const configurableParts = manifest.configurableParts || [];
        const newColors: Record<string, string> = {};
        
        configurableParts.forEach(partId => {
          newColors[partId] = colorId;
        });

        set({ 
          selectedColors: newColors,
          finishMode: 'colors',
          configId: generateConfigId(),
        });
      },

      setPartColorOverride: (partId: string, colorId: string | null) => {
        const { partColorOverrides } = get();
        console.log('🔧 setPartColorOverride called:', { partId, colorId, currentOverrides: partColorOverrides });
        
        if (colorId === null) {
          // Remove override
          const newOverrides = { ...partColorOverrides };
          delete newOverrides[partId];
          console.log('🔧 Removing override, new overrides:', newOverrides);
          set({ partColorOverrides: newOverrides, configId: generateConfigId() });
        } else {
          // Set override
          const newOverrides = { ...partColorOverrides, [partId]: colorId };
          console.log('🔧 Adding override, new overrides:', newOverrides);
          set({ 
            partColorOverrides: newOverrides,
            configId: generateConfigId()
          });
        }
      },

      clearPartColorOverride: (partId: string) => {
        const { partColorOverrides } = get();
        console.log('🧹 clearPartColorOverride called for:', partId);
        console.log('🧹 Current overrides before clear:', partColorOverrides);
        
        const newOverrides = { ...partColorOverrides };
        delete newOverrides[partId];
        
        console.log('🧹 New overrides after clear:', newOverrides);
        
        set({ 
          partColorOverrides: newOverrides, 
          configId: generateConfigId() 
        });
        
        console.log('🧹 State updated, should trigger re-render');
      },

      // Caliber action
      selectCaliber: (caliberId: string) => {
        console.log('Selecting caliber:', caliberId);
        set({ 
          selectedCaliber: caliberId,
          configId: generateConfigId(),
        });
      },

      // Suppressor action
      selectSuppressor: (suppressorId: string) => {
        console.log('Selecting suppressor:', suppressorId);
        set({ 
          selectedSuppressor: suppressorId,
          configId: generateConfigId(),
        });
      },

      // Trigger action
      selectTrigger: (triggerId: string) => {
        console.log('Selecting trigger:', triggerId);
        set({ 
          selectedTrigger: triggerId,
          configId: generateConfigId(),
        });
      },

      // Get current model file path
      getCurrentModelFile: () => {
        const { manifest, selectedSuppressor } = get();
        if (!manifest || !manifest.suppressors) {
          return 'product.glb'; // fallback
        }
        
        const suppressor = manifest.suppressors.find(s => s.id === selectedSuppressor);
        return suppressor?.modelFile || manifest.suppressors[0]?.modelFile || 'product.glb';
      },

      // Legacy actions (for backward compatibility)
      selectOption: (partId, optionId) => {
        const { manifest, selectedOptions } = get();
        if (!manifest) return;

        const newOptions = { ...selectedOptions, [partId]: optionId };
        
        // Auto-sync carry handle with both clamps
        if (partId === 'carryHandle') {
          newOptions.handleClamp = optionId;
          newOptions.handGuardClamp = optionId;
          console.log(`Auto-synced handle clamp and hand guard clamp to ${optionId}`);
        }
        
        // Apply rules if they exist
        const part = manifest.parts.find(p => p.id === partId);
        const option = part?.options?.find(o => o.id === optionId);
        
        if (option?.rules) {
          option.rules.forEach(rule => {
            if (rule.type === 'enable') {
              newOptions[rule.condition.partId] = rule.condition.optionId;
            } else if (rule.type === 'disable') {
              if (newOptions[rule.condition.partId] === rule.condition.optionId) {
                const targetPart = manifest.parts.find(p => p.id === rule.condition.partId);
                if (targetPart && targetPart.options && targetPart.options.length > 0) {
                  newOptions[rule.condition.partId] = targetPart.options[0].id;
                }
              }
            }
          });
        }

        set({ 
          selectedOptions: newOptions,
          configId: generateConfigId(),
        });
      },

      setActivePart: (partId) => set({ activePartId: partId }),
      
      setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

      toggleConfigMenu: () => set((state) => ({ 
        isConfigMenuOpen: !state.isConfigMenuOpen 
      })),

      setCinemaMode: (enabled) => set({ 
        isCinemaMode: enabled,
        isConfigMenuOpen: enabled ? false : get().isConfigMenuOpen,
      }),

      setConfirmationMode: (enabled) => set({ isConfirmationMode: enabled }),

      setQualityMode: (mode) => set({ qualityMode: mode }),

      setHideHotspots: (hide: boolean) => set({ hideHotspots: hide }),

      setCameraPreset: (preset) => set({ cameraPreset: preset }),

      setCustomCameraState: (state) => set({ customCameraState: state }),

      updateHotspot: (partId, position) => {
        const { computedHotspots } = get();
        const updatedHotspots = computedHotspots.map(hotspot =>
          hotspot.partId === partId
            ? { ...hotspot, position: { x: position[0], y: position[1], z: position[2] } }
            : hotspot
        );
        set({ computedHotspots: updatedHotspots });
      },

      reset: () => {
        const { manifest } = get();
        if (!manifest) return;

        // Reset colors to defaults
        const defaultColors: Record<string, string> = {};
        const configurableParts = manifest.configurableParts || [];
        const firstColorOption = manifest.finishModes?.colors?.options?.[0];
        
        if (firstColorOption) {
          configurableParts.forEach(partId => {
            defaultColors[partId] = firstColorOption.id;
          });
        }

        // Reset caliber to default
        const defaultCaliber = manifest.calibers?.find(c => c.id === '408-cheytac') || manifest.calibers?.[0];

        // Reset suppressor to default
        const defaultSuppressor = manifest.suppressors?.find(s => s.id === 'm3-suppressor') || manifest.suppressors?.[0];

        // Reset trigger to default
        const defaultTrigger = manifest.triggers?.find(t => t.id === 'timney-elite-curved') || manifest.triggers?.[0];

        // Legacy compatibility
        const defaultOptions: Record<string, string> = {};
        manifest.parts.forEach(part => {
          if (part.options && part.options.length > 0) {
            defaultOptions[part.id] = part.options[0].id;
          }
        });

        set({
          finishMode: 'colors',
          selectedPattern: null,
          selectedColors: defaultColors,
          selectedCaliber: defaultCaliber?.id || null,
          selectedSuppressor: defaultSuppressor?.id || null,
          selectedTrigger: defaultTrigger?.id || null,
          selectedOptions: defaultOptions,
          partColorOverrides: {},  // Clear all overrides
          activePartId: null,
          activeGroupId: null,
          isCinemaMode: false,
          isConfirmationMode: false,
          hideHotspots: false,
          cameraPreset: 'hero',
          customCameraState: null,
          configId: generateConfigId(),
          configPanelOpen: false,
          configPanelPartId: null,
          modalOpen: false,
          modalPartId: null,
        });
      },

      generateNewConfigId: () => set({ configId: generateConfigId() }),

      getSelectedMaterials: () => {
        const { manifest, finishMode, selectedPattern, selectedColors, selectedOptions, partColorOverrides } = get();
        console.log('🎨 getSelectedMaterials called:', { 
          finishMode, 
          selectedPattern, 
          partColorOverridesCount: Object.keys(partColorOverrides).length,
          selectedColorsCount: Object.keys(selectedColors).length 
        });
        
        if (!manifest) return {};

        const materials: Record<string, any> = {};

        // Define meshes that should ALWAYS stay black
        const alwaysBlackMeshes = [
          'Direct_Thread_HUB_Mount',
          '*HUB_Mount*',
          'CT_2-006_Bolt_Handle_Shaft',
          'CT_2-007_Bolt_Handle_Knob',
          'CT_5-013-2_Bipod_Locking_Pin_Release_Knob',
          'CT_5-013-2_Bipod_Locking_Pin_Release_Knob001',
          'CT_5-018-2_Bipod_Foot_Release_Housing',
          'CT_5-018-2_Bipod_Foot_Release_Housing001',
          'CT_5-020_Bipod_Foot_Release',
          'CT_5-020_Bipod_Foot_Release001'
        ];

        const blackMaterial = {
          type: 'color',
          color: '#000000',
          metalness: 0.3,
          roughness: 0.8
        };

        // Helper function to check if a mesh should stay black
        const shouldStayBlack = (meshName: string): boolean => {
          return alwaysBlackMeshes.some(pattern => {
            if (pattern.startsWith('*') && pattern.endsWith('*')) {
              const search = pattern.slice(1, -1);
              return meshName.includes(search);
            }
            return meshName === pattern;
          });
        };

        // FORCE TRIGGER ASSEMBLY TO ALWAYS BE BLACK
        const triggerPart = manifest.parts?.find(p => p.id === 'triggerAssembly');
        if (triggerPart) {
          triggerPart.meshSelectors?.forEach(selector => {
            materials[selector] = blackMaterial;
          });
          console.log('🔫 Applied black material to trigger assembly meshes');
        }

        const configurableParts = manifest.configurableParts || [];

        if (finishMode === 'patterns') {
          console.log('🎨 PATTERN MODE');
          const hasAnyOverrides = Object.keys(partColorOverrides).length > 0;
          console.log('   Has overrides:', hasAnyOverrides);
          console.log('   Selected pattern:', selectedPattern);
          
          if (selectedPattern) {
            console.log('   → Applying pattern with overrides');
            // Pattern mode with pattern: apply pattern to all parts, but respect color overrides
            const patternOption = manifest.finishModes?.patterns?.options?.find(
              option => option.id === selectedPattern
            );
            
            if (patternOption) {
              configurableParts.forEach(partId => {
                const colorOverride = partColorOverrides[partId];
                
                if (colorOverride) {
                  const colorOption = manifest.finishModes?.colors?.options?.find(
                    option => option.id === colorOverride
                  );
                  if (colorOption) {
                    const part = manifest.parts?.find(p => p.id === partId);
                    if (part) {
                      part.meshSelectors?.forEach(selector => {
                        if (!shouldStayBlack(selector)) {
                          materials[selector] = colorOption.material;
                        }
                      });
                    }
                  }
                } else {
                  const part = manifest.parts?.find(p => p.id === partId);
                  if (part) {
                    part.meshSelectors?.forEach(selector => {
                      if (!shouldStayBlack(selector)) {
                        materials[selector] = patternOption.material;
                      }
                    });
                  }
                }
              });
            }
          } else if (hasAnyOverrides) {
            console.log('   → Using color customizations (with fallback to selectedColors)');
            // Pattern mode but no pattern - check overrides first, then fallback to selectedColors
            configurableParts.forEach(partId => {
              // Check override first
              const colorOverride = partColorOverrides[partId];
              // Fallback to selectedColors if no override
              const colorId = colorOverride || selectedColors[partId];
              
              console.log(`     Part ${partId}: override=${colorOverride}, fallback=${selectedColors[partId]}, final=${colorId}`);
              
              if (colorId) {
                const colorOption = manifest.finishModes?.colors?.options?.find(
                  option => option.id === colorId
                );
                if (colorOption) {
                  const part = manifest.parts?.find(p => p.id === partId);
                  if (part) {
                    part.meshSelectors?.forEach(selector => {
                      if (!shouldStayBlack(selector)) {
                        materials[selector] = colorOption.material;
                        console.log(`     ✅ Applied color to: ${selector} (${colorOption.label})`);
                      }
                    });
                  }
                }
              }
            });
          } else {
            console.log('   → FALLBACK: Using selectedColors from Colors mode');
            console.log('   selectedColors:', selectedColors);
            // CRITICAL FALLBACK: Use selectedColors to maintain appearance
            configurableParts.forEach(partId => {
              const colorId = selectedColors[partId];
              console.log('     Part:', partId, '→ Color:', colorId);
              if (colorId) {
                const colorOption = manifest.finishModes?.colors?.options?.find(
                  option => option.id === colorId
                );
                console.log('     Color option found:', colorOption?.label);
                if (colorOption) {
                  const part = manifest.parts?.find(p => p.id === partId);
                  if (part) {
                    part.meshSelectors?.forEach(selector => {
                      if (!shouldStayBlack(selector)) {
                        materials[selector] = colorOption.material;
                        console.log('     ✅ Applied fallback color to:', selector);
                      }
                    });
                  }
                }
              }
            });
          }
        } else if (finishMode === 'colors') {
          console.log('🎨 COLORS MODE - applying selectedColors');
          // Color mode: apply individual colors to parts
          configurableParts.forEach(partId => {
            const colorId = selectedColors[partId];
            if (colorId) {
              const colorOption = manifest.finishModes?.colors?.options?.find(
                option => option.id === colorId
              );
              
              if (colorOption) {
                const part = manifest.parts?.find(p => p.id === partId);
                if (part) {
                  part.meshSelectors?.forEach(selector => {
                    if (!shouldStayBlack(selector)) {
                      materials[selector] = colorOption.material;
                    }
                  });
                }
              }
            }
          });
        }

        // Apply black material to all meshes that should stay black
        alwaysBlackMeshes.forEach(pattern => {
          materials[pattern] = blackMaterial;
        });

        console.log('🎨 Final material count:', Object.keys(materials).length);
        return materials;
      },

      getConfigurationPayload: () => {
        const { 
          manifest, 
          finishMode, 
          selectedPattern, 
          selectedColors, 
          selectedOptions, 
          partColorOverrides,
          selectedCaliber,
          selectedSuppressor,
          selectedTrigger,
          configId 
        } = get();
        
        return {
          configId,
          productName: manifest?.productName,
          sku: manifest?.sku,
          finishMode,
          selectedPattern,
          selectedColors,
          partColorOverrides,
          selectedCaliber,
          selectedSuppressor,
          selectedTrigger,
          selectedOptions,
          timestamp: new Date().toISOString(),
        };
      },

      // Configuration Panel actions (OLD)
      setConfigPanelOpen: (open: boolean) => set({ configPanelOpen: open }),
      
      setConfigPanelPartId: (partId: string | null) => set({ configPanelPartId: partId }),
      
      updateConfiguration: (partId: string, optionId: string) => {
        get().selectOption(partId, optionId);
      },
      
   // Modal actions (NEW)
setModalOpen: (open: boolean) => {
  console.log('🔴 setModalOpen called with:', open);
  if (!open) {
    // When closing modal, also clear the part ID
    console.log('🔴 Modal closing, clearing modalPartId');
    set({ modalOpen: false, modalPartId: null });
  } else {
    set({ modalOpen: open });
  }
},

setModalPartId: (partId: string | null) => {
  console.log('🔴 setModalPartId called with:', partId);
  if (partId === null) {
    // When clearing part ID, also close modal
    set({ modalPartId: null, modalOpen: false });
  } else {
    // When setting a part ID, open the modal
    set({ modalPartId: partId, modalOpen: true });
  }
},

focusCameraOnPart: (partId: string) => {
  console.log('Focusing camera on part:', partId);
  get().setCameraPreset('detail');
},

getPartUIGroup: (partId: string) => {
  const { manifest } = get();
  if (!manifest) return null;
  return manifest.ui?.find(group => group.partIds.includes(partId));
}
    }),
    {
      name: 'product-configurator-storage',
      partialize: (state) => ({
        finishMode: state.finishMode,
        selectedPattern: state.selectedPattern,
        selectedColors: state.selectedColors,
        partColorOverrides: state.partColorOverrides,
        selectedCaliber: state.selectedCaliber,
        selectedSuppressor: state.selectedSuppressor,
        selectedTrigger: state.selectedTrigger,
        selectedOptions: state.selectedOptions,
        configId: state.configId,
        qualityMode: state.qualityMode,
      }),
    }
  )
);
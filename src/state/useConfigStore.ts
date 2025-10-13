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
        set({ 
          finishMode: mode,
          configId: generateConfigId(),
        });
      },

      selectPattern: (patternId: string) => {
        console.log('Selecting pattern:', patternId);
        set({ 
          selectedPattern: patternId,
          finishMode: 'patterns',
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
        const newOverrides = { ...partColorOverrides };
        delete newOverrides[partId];
        set({ partColorOverrides: newOverrides, configId: generateConfigId() });
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
          selectedOptions: defaultOptions,
          partColorOverrides: {},
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
        console.log('🎨 getSelectedMaterials called:', { finishMode, selectedPattern, partColorOverrides });
        
        if (!manifest) return {};

        const materials: Record<string, any> = {};

        if (finishMode === 'patterns' && selectedPattern) {
          console.log('🎨 Pattern mode with pattern:', selectedPattern);
          // Pattern mode: apply pattern to all parts, but respect color overrides
          const patternOption = manifest.finishModes?.patterns?.options?.find(
            option => option.id === selectedPattern
          );
          
          if (patternOption) {
            const configurableParts = manifest.configurableParts || [];
            configurableParts.forEach(partId => {
              // Check if this part has a color override
              const colorOverride = partColorOverrides[partId];
              
              if (colorOverride) {
                console.log('🎨 Part', partId, 'has color override:', colorOverride);
                // Use the color override instead of pattern
                const colorOption = manifest.finishModes?.colors?.options?.find(
                  option => option.id === colorOverride
                );
                if (colorOption) {
                  const part = manifest.parts?.find(p => p.id === partId);
                  if (part) {
                    part.meshSelectors?.forEach(selector => {
                      materials[selector] = colorOption.material;
                      console.log('🎨 Applied color override to mesh:', selector);
                    });
                  }
                }
              } else {
                // Use the pattern
                const part = manifest.parts?.find(p => p.id === partId);
                if (part) {
                  part.meshSelectors?.forEach(selector => {
                    materials[selector] = patternOption.material;
                  });
                }
              }
            });
          }
        } else if (finishMode === 'colors') {
          // Color mode: apply individual colors to parts
          const configurableParts = manifest.configurableParts || [];
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
                    materials[selector] = colorOption.material;
                  });
                }
              }
            }
          });
        }

        // Legacy compatibility: apply legacy options if no new system materials found
        if (Object.keys(materials).length === 0) {
          manifest.parts.forEach(part => {
            const selectedOptionId = selectedOptions[part.id];
            const option = part.options?.find(o => o.id === selectedOptionId);
            
            if (option) {
              part.meshSelectors?.forEach(selector => {
                materials[selector] = option.material;
              });
            }
          });
        }

        console.log('🎨 Final materials:', materials);
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
      setModalOpen: (open: boolean) => set({ modalOpen: open }),
      
      setModalPartId: (partId: string | null) => set({ modalPartId: partId }),
      
      focusCameraOnPart: (partId: string) => {
        console.log('Focusing camera on part:', partId);
        get().setCameraPreset('detail');
      },
      
      getPartUIGroup: (partId: string) => {
        const { manifest } = get();
        if (!manifest) return null;
        return manifest.ui?.find(group => group.partIds.includes(partId));
      },
    }),
    {
      name: 'product-configurator-storage',
      partialize: (state) => ({
        finishMode: state.finishMode,
        selectedPattern: state.selectedPattern,
        selectedColors: state.selectedColors,
        partColorOverrides: state.partColorOverrides,
        selectedOptions: state.selectedOptions,
        configId: state.configId,
        qualityMode: state.qualityMode,
      }),
    }
  )
);
// src/utils/manifestValidator.ts
import { z } from 'zod';

// Base schemas
const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const CameraSchema = z.object({
  position: Vector3Schema,
  target: Vector3Schema,
  fov: z.number().min(10).max(120),
});

const HotspotSchema = z.object({
  partId: z.string(),
  position: Vector3Schema,
  title: z.string(),
  summary: z.string().optional(),
});

const UIGroupSchema = z.object({
  groupId: z.string(),
  label: z.string(),
  partIds: z.array(z.string()),
});

// NEW: Caliber schema
const CaliberSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  specifications: z.object({
    bulletWeight: z.string().optional(),
    muzzleVelocity: z.string().optional(),
    energy: z.string().optional(),
  }).optional(),
});

// NEW: Suppressor schema
const SuppressorSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  modelFile: z.string(), // GLB filename
});

// NEW: Texture system schemas
const TextureRepeatSchema = z.record(z.string(), z.tuple([z.number(), z.number()])).and(
  z.object({
    default: z.tuple([z.number(), z.number()]).optional(),
  })
);

const ColorMaterialSchema = z.object({
  type: z.literal('color'),
  color: z.string(),
  metalness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
});

const TextureMaterialSchema = z.object({
  type: z.literal('texture'),
  textureUrl: z.string(),
  metalness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  repeat: TextureRepeatSchema.optional(),
});

const NewMaterialSchema = z.union([ColorMaterialSchema, TextureMaterialSchema]);

// Legacy material schemas (for backward compatibility)
const PBRMaterialSchema = z.object({
  baseColor: z.string(),
  textureRoughness: z.string().optional(),
  textureMetallic: z.string().optional(),
  textureNormal: z.string().optional(),
  textureAO: z.string().optional(),
});

const SimpleMaterialSchema = z.object({
  color: z.string(),
  metalness: z.number().min(0).max(1),
  roughness: z.number().min(0).max(1),
});

const LegacyMaterialSchema = z.union([
  z.object({ pbrMetallicRoughness: PBRMaterialSchema }),
  SimpleMaterialSchema,
]);

// Combined material schema for backward compatibility
const MaterialSchema = z.union([NewMaterialSchema, LegacyMaterialSchema]);

const DecalSchema = z.object({
  texture: z.string(),
  uvChannel: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const RuleSchema = z.object({
  type: z.enum(['enable', 'disable']),
  condition: z.object({
    partId: z.string(),
    optionId: z.string(),
  }),
});

// NEW: Finish system schemas
const FinishOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  thumbnail: z.string().optional(),
  material: NewMaterialSchema,
});

const FinishModeSchema = z.object({
  label: z.string(),
  description: z.string(),
  allowIndividualSelection: z.boolean(),
  options: z.array(FinishOptionSchema),
});

const FinishModesSchema = z.object({
  colors: FinishModeSchema,
  patterns: FinishModeSchema,
});

const MaterialCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});

// Legacy option schema (for backward compatibility)
const OptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string().optional(),
  material: MaterialSchema,
  decals: z.array(DecalSchema).optional(),
  rules: z.array(RuleSchema).optional(),
});

const PartSchema = z.object({
  id: z.string(),
  label: z.string(),
  meshSelectors: z.array(z.string()),
  hasCaliber: z.boolean().optional(), // NEW: Flag for parts that have caliber options
  hasSuppressor: z.boolean().optional(), // NEW: Flag for parts that have suppressor options
  options: z.array(OptionSchema).optional(), // Made optional for new system
});

export const ManifestSchema = z.object({
  productName: z.string(),
  sku: z.string(),
  defaultCamera: CameraSchema,
  hotspots: z.array(HotspotSchema),
  ui: z.array(UIGroupSchema),
  parts: z.array(PartSchema),
  
  // NEW: Texture system properties
  configurableParts: z.array(z.string()).optional(),
  materialCategories: z.array(MaterialCategorySchema).optional(),
  finishModes: FinishModesSchema.optional(),
  calibers: z.array(CaliberSchema).optional(), // NEW: Caliber options
  suppressors: z.array(SuppressorSchema).optional(), // NEW: Suppressor options
});

// TypeScript types derived from schemas
export type Vector3 = z.infer<typeof Vector3Schema>;
export type Camera = z.infer<typeof CameraSchema>;
export type Hotspot = z.infer<typeof HotspotSchema>;
export type UIGroup = z.infer<typeof UIGroupSchema>;

// NEW: Caliber type
export type Caliber = z.infer<typeof CaliberSchema>;

// NEW: Suppressor type
export type Suppressor = z.infer<typeof SuppressorSchema>;

// NEW: Texture system types
export type ColorMaterial = z.infer<typeof ColorMaterialSchema>;
export type TextureMaterial = z.infer<typeof TextureMaterialSchema>;
export type NewMaterial = z.infer<typeof NewMaterialSchema>;
export type FinishOption = z.infer<typeof FinishOptionSchema>;
export type FinishMode = z.infer<typeof FinishModeSchema>;
export type FinishModes = z.infer<typeof FinishModesSchema>;
export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;

// Legacy types (for backward compatibility)
export type PBRMaterial = z.infer<typeof PBRMaterialSchema>;
export type SimpleMaterial = z.infer<typeof SimpleMaterialSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type Decal = z.infer<typeof DecalSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type Part = z.infer<typeof PartSchema>;
export type ProductManifest = z.infer<typeof ManifestSchema>;

export function validateManifest(data: unknown): ProductManifest {
  return ManifestSchema.parse(data);
}

export function safeValidateManifest(data: unknown): { success: true; data: ProductManifest } | { success: false; error: z.ZodError } {
  const result = ManifestSchema.safeParse(data);
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
}

// NEW: Enhanced validation with auto-migration
export function validateAndMigrateManifest(data: unknown): ProductManifest {
  const manifest = ManifestSchema.parse(data);
  
  // Auto-generate configurableParts if missing
  if (!manifest.configurableParts) {
    manifest.configurableParts = manifest.parts
      .filter(part => part.options && part.options.length > 0)
      .map(part => part.id);
  }
  
  // Auto-generate basic finishModes if missing
  if (!manifest.finishModes) {
    const firstPart = manifest.parts.find(part => part.options && part.options.length > 0);
    if (firstPart) {
      // Extract unique colors from all parts
      const allColors = new Map<string, FinishOption>();
      
      manifest.parts.forEach(part => {
        part.options?.forEach(option => {
          if ('color' in option.material && typeof option.material.color === 'string') {
            allColors.set(option.id, {
              id: option.id,
              label: option.label,
              material: {
                type: 'color',
                color: option.material.color,
                metalness: option.material.metalness || 0.3,
                roughness: option.material.roughness || 0.8,
              }
            });
          }
        });
      });
      
      manifest.finishModes = {
        colors: {
          label: "Custom Colors",
          description: "Choose individual colors for each part",
          allowIndividualSelection: true,
          options: Array.from(allColors.values()),
        },
        patterns: {
          label: "Tactical Patterns",
          description: "Apply one pattern to entire rifle",
          allowIndividualSelection: false,
          options: [], // Will be populated when textures are added
        }
      };
    }
  }
  
  return manifest;
}
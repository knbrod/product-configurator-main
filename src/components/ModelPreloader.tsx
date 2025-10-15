import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';
import { useConfigStore } from '../state/useConfigStore';

export function ModelPreloader() {
  const { manifest, productPath } = useConfigStore();

  useEffect(() => {
    if (!manifest || !manifest.suppressors) return;

    console.log('🚀 Preloading all suppressor models...');
    
    // Preload all suppressor models
    manifest.suppressors.forEach((suppressor) => {
      const modelPath = `${productPath}/products/example-product/${suppressor.modelFile}`;
      useGLTF.preload(modelPath);
      console.log(`✓ Preloaded: ${suppressor.label}`);
    });

    console.log('✅ All models preloaded!');
  }, [manifest, productPath]);

  return null; // This component doesn't render anything
}
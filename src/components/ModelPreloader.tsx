// src/components/ModelPreloader.tsx
import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';
import { useConfigStore } from '../state/useConfigStore';

export function ModelPreloader() {
  const manifest = useConfigStore(state => state.manifest);
  const productPath = useConfigStore(state => state.productPath);

  useEffect(() => {
    // Skip preloading on mobile to save memory
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
      console.log('📱 Mobile detected - skipping preload to save memory');
      return;
    }

    if (!manifest || !manifest.suppressors) return;

    console.log('🚀 Preloading all suppressor models...');
    
    manifest.suppressors.forEach((suppressor) => {
      const modelPath = `${productPath}/products/example-product/${suppressor.modelFile}`;
      useGLTF.preload(modelPath);
    });

    console.log('✅ All models preloaded!');
  }, [manifest, productPath]);

  return null;
}

ModelPreloader.clearCache = () => {
  const manifest = useConfigStore.getState().manifest;
  const productPath = useConfigStore.getState().productPath;

  if (manifest && manifest.suppressors) {
    manifest.suppressors.forEach((suppressor) => {
      const modelPath = `${productPath}/products/example-product/${suppressor.modelFile}`;
      useGLTF.clear(modelPath);
    });
  }
};
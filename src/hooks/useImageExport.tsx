// src/hooks/useImageExport.ts
import React, { useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useConfigStore } from '../state/useConfigStore';
import * as THREE from 'three';

export const useImageExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { scene, gl, camera } = useThree();
  const { selectedOptions, manifest } = useConfigStore();

  const exportImage = async (width: number = 2048, height: number = 2048) => {
    setIsExporting(true);
    
    try {
      // Store original renderer size
      const originalSize = gl.getSize(new THREE.Vector2());
      const originalPixelRatio = gl.getPixelRatio();
      
      // Set high resolution for export
      gl.setPixelRatio(1);
      gl.setSize(width, height);
      
      // Render at high quality
      gl.render(scene, camera);
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `M200-Configuration-${timestamp}.png`;
      
      // Export as blob and download
      const blob = await new Promise<Blob>((resolve) => {
        gl.domElement.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png', 1.0);
      });
      
      // Download the file
      downloadBlob(blob, filename);
      
      // Restore original renderer settings
      gl.setPixelRatio(originalPixelRatio);
      gl.setSize(originalSize.x, originalSize.y);
      
      return { success: true, filename };
      
    } catch (error: any) {
      console.error('Image export failed:', error);
      return { success: false, error: error.message };
    } finally {
      setIsExporting(false);
    }
  };

  return { exportImage, isExporting };
};

// Utility function to download blob
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Toast notification function
const showToast = (message: string, type: 'success' | 'error') => {
  const toast = document.createElement('div');
  toast.className = `export-toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
};

// Simple export button component
interface ImageExportButtonProps {
  className?: string;
  quality?: 'HD' | '4K';
}

export const ImageExportButton: React.FC<ImageExportButtonProps> = ({ 
  className = '',
  quality = 'HD'
}) => {
  const { exportImage, isExporting } = useImageExport();
  
  const dimensions = quality === '4K' ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 };

  const handleExport = async () => {
    const result = await exportImage(dimensions.width, dimensions.height);
    
    if (result.success) {
      showToast(`Successfully exported: ${result.filename}`, 'success');
    } else {
      showToast(`Export failed: ${result.error}`, 'error');
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`image-export-btn ${className}`}
    >
      {isExporting ? (
        <>
          <div className="export-spinner" />
          Exporting...
        </>
      ) : (
        <>
          Export {quality} Image
        </>
      )}
    </button>
  );
};

// Floating export panel
export const FloatingExportPanel: React.FC = () => {
  return (
    <div className="floating-export-panel">
      <ImageExportButton quality="HD" className="export-btn-primary" />
      <ImageExportButton quality="4K" className="export-btn-secondary" />
    </div>
  );
};

// Alternative: Simple export button for header/toolbar
export const SimpleExportButton: React.FC = () => {
  const { exportImage, isExporting } = useImageExport();

  const handleQuickExport = async () => {
    const result = await exportImage(1920, 1080); // HD by default
    
    if (result.success) {
      showToast(`Successfully exported: ${result.filename}`, 'success');
    } else {
      showToast(`Export failed: ${result.error}`, 'error');
    }
  };

  return (
    <button
      onClick={handleQuickExport}
      disabled={isExporting}
      className="simple-export-btn"
      title="Export HD image of current configuration"
    >
      {isExporting ? '⏳' : '📷'}
    </button>
  );
};
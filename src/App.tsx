// src/App.tsx - Clean 3D Configurator with Single-View Export
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useConfigStore } from './state/useConfigStore';
import { validateManifest } from './utils/manifestValidator';
import { TestModelViewer } from './components/ModelViewer/TestModelViewer';
import { LuxuryConfigurator, LuxuryConfigModal } from './components/Configurator/LuxuryConfigurator';
import { UIControls } from './components/UIControls/UIControls';

// Toast notification function
function showToast(message: string, type: 'success' | 'error' = 'success') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.export-toast');
  existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `export-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function App() {
  console.log('App: Component rendering');
  const { loadManifest } = useConfigStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [itarCollapsed, setItarCollapsed] = useState(true); // Collapsed by default on mobile

  // Single-view export function
  const handleExport = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Hide UI elements during export
    const itarNotice = document.querySelector('.itar-notice') as HTMLElement;
    const exportButton = document.querySelector('button') as HTMLElement;
    
    const originalItarDisplay = itarNotice?.style.display;
    const originalButtonDisplay = exportButton?.style.display;
    
    if (itarNotice) itarNotice.style.display = 'none';
    if (exportButton) exportButton.style.display = 'none';

    try {
      // Wait a moment for UI to hide
      await new Promise(resolve => setTimeout(resolve, 100));

      // Ensure WebGL is finished rendering
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        gl.finish();
      }

      // Create export canvas
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      
      if (ctx) {
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        
        // White background
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // Draw the 3D scene
        ctx.drawImage(canvas, 0, 0);
        
        // Add logo overlay
        const logoImg = document.querySelector('img[alt="Company Logo"]') as HTMLImageElement;
        if (logoImg && logoImg.complete) {
          const logoScale = 0.8;
          const logoWidth = logoImg.naturalWidth * logoScale;
          const logoHeight = logoImg.naturalHeight * logoScale;
          const padding = 40;
          
          // Draw background behind logo
          ctx.fillStyle = 'rgba(255, 255, 255, 1)';
          ctx.fillRect(padding - 20, padding - 20, logoWidth + 40, logoHeight + 40);
          
          // Draw logo
          ctx.drawImage(logoImg, padding, padding, logoWidth, logoHeight);
        }
        
        // Download image
        const timestamp = new Date().toISOString().split('T')[0];
        const link = document.createElement('a');
        link.download = `M200-Configuration-${timestamp}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
        
        showToast('Successfully exported configuration', 'success');
      }

    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      // Restore UI elements
      if (itarNotice && originalItarDisplay !== undefined) {
        itarNotice.style.display = originalItarDisplay;
      }
      if (exportButton && originalButtonDisplay !== undefined) {
        exportButton.style.display = originalButtonDisplay;
      }
    }
  };

  useEffect(() => {
    loadProductManifest();
    
    // Auto-expand ITAR notice on desktop
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setItarCollapsed(false);
      }
    };
    
    handleResize(); // Check initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadProductManifest = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/products/example-product/product.manifest.json');
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.statusText}`);
      }
      
      const manifestData = await response.json();
      const validatedManifest = validateManifest(manifestData);
      
      loadManifest(validatedManifest, 'https://cheytac-assets.sfo3.digitaloceanspaces.com');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
      console.error('Failed to load product manifest:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        background: 'linear-gradient(to bottom right, #1f2937, #000000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Loading configurator...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        background: 'linear-gradient(to bottom right, #302f2eff, #000000ff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#ef4444', fontSize: '18px', textAlign: 'center' }}>
          <div>{error}</div>
          <div style={{ fontSize: '14px', color: '#ccc', marginTop: '10px' }}>
            Check console for details
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(to bottom right, #efddddd3, #000000)' }}>
      <Canvas 
        camera={{ 
          position: [2, 1, 4], 
          fov: 75,
          near: 0.1,
          far: 1000
        }} 
        gl={{
          logarithmicDepthBuffer: true,
          antialias: true,
          preserveDrawingBuffer: true
        }}
        shadows
      >
        <TestModelViewer 
          productPath="https://cheytac-assets.sfo3.digitaloceanspaces.com"
          onLoadComplete={() => setModelLoading(false)}
        />
        <LuxuryConfigurator />
      </Canvas>
      
      <LuxuryConfigModal />
      <UIControls />
      
      {/* Company Logo */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: '#efddddd3',
        padding: '15px',
        borderRadius: '8px'
      }}>
        <img 
          src="/logo.png" 
          alt="Company Logo" 
          style={{ height: '40px', width: 'auto' }}
        />
      </div>
      
      {/* Export Button */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <button
          onClick={handleExport}
          style={{
            background: '#ba2025',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          Export Configuration
        </button>
      </div>
      
      {/* ITAR Notice - Collapsible on Mobile */}
      <div 
        className="itar-notice"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          background: '#ba2025',
          color: 'white',
          padding: itarCollapsed ? '10px 12px' : '15px',
          borderRadius: '8px',
          maxWidth: itarCollapsed ? 'auto' : '280px',
          fontSize: '11px',
          lineHeight: '1.4',
          border: '2px solid #ba2025',
          zIndex: 30,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setItarCollapsed(!itarCollapsed)}
      >
        {itarCollapsed ? (
          // Collapsed view - just icon and short text
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontWeight: 'bold',
            fontSize: '12px'
          }}>
            <span>⚠️ ITAR</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>▶</span>
          </div>
        ) : (
          // Expanded view - full notice
          <>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px', 
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>⚠️ ITAR / EAR NOTICE</span>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>▼</span>
            </div>
            <div>
              This configurator is for demonstration purposes only. This does not constitute a sale or offer for sale. 
              Export restrictions may apply under ITAR and EAR regulations.
            </div>
          </>
        )}
      </div>

      {/* 3D Model Loading Overlay */}
      {modelLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom right, #FAF9F6, #EAE8E4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <img 
            src="/logo.png" 
            alt="CheyTac USA" 
            style={{ 
              height: '120px', 
              width: 'auto',
              marginBottom: '30px',
              animation: 'pulse 2s ease-in-out infinite'
            }}
          />
          <div style={{
            color: '#BA2025',
            fontSize: '16px',
            fontWeight: '600',
            letterSpacing: '1px'
          }}>
            LOADING CONFIGURATOR
          </div>
          <div style={{
            width: '200px',
            height: '3px',
            background: 'rgba(186, 32, 37, 0.2)',
            borderRadius: '2px',
            marginTop: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: '#BA2025',
              animation: 'loadingBar 2s ease-in-out infinite'
            }} />
          </div>
        </div>
      )}

      {/* CSS for animations and toasts */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.98); }
        }
        
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .export-toast {
          position: fixed;
          top: 100px;
          right: 20px;
          padding: 12px 20px;
          borderRadius: 8px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          z-index: 10000;
          max-width: 400px;
          animation: toastSlideIn 0.3s ease-out;
        }
        
        .export-toast.success {
          background: linear-gradient(135deg, #BA2025, #8B1519);
          border-left: 4px solid #D42428;
        }
        
        .export-toast.error {
          background: linear-gradient(135deg, #BA2025, #8B1519);
          border-left: 4px solid #D42428;
        }
        
        @keyframes toastSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes toastSlideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        /* Mobile responsive fix - prevents ITAR notice and Export button overlap */
        @media (max-width: 768px) {
          .itar-notice {
            bottom: 100px !important;
            left: 10px !important;
            right: auto !important;
            font-size: 10px !important;
          }
        }
        
        /* Desktop - always show expanded */
        @media (min-width: 769px) {
          .itar-notice {
            max-width: 280px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
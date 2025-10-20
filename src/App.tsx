// src/App.tsx - Clean 3D Configurator with Single-View Export and Part Clicking
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useConfigStore } from './state/useConfigStore';
import { validateManifest } from './utils/manifestValidator';
import { TestModelViewer } from './components/ModelViewer/TestModelViewer';
import { LuxuryConfigurator, LuxuryConfigModal } from './components/Configurator/LuxuryConfigurator';
import { UIControls } from './components/UIControls/UIControls';
import { ModelPreloader } from './components/ModelPreloader';
import { PartClickHandler } from './components/PartClickHandler';

// Disable console logs in production to improve performance
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
}

// Auto-detect if we're in development or production
const PRODUCT_PATH = import.meta.env.DEV 
  ? '' // Local development - load from public folder
  : 'https://cheytac-assets.sfo3.cdn.digitaloceanspaces.com'; // Production - CDN URL

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
  const [showDisclaimer, setShowDisclaimer] = useState(false); // Show disclaimer after loading
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false); // Track if user acknowledged
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([-7, 0.8, 0]);
  const [showOrderModal, setShowOrderModal] = useState(false); // Order process modal
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(false); // Email opt-in state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false); // Share modal

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

  // Handle order process submission
  const handleStartOrder = async () => {
    if (!customerName || !customerEmail || !customerPhone) {
      showToast('Please enter your name, email, and phone number', 'error');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    // Validate phone (basic validation - at least 10 digits)
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get configuration state from store
      const state = useConfigStore.getState();
      const { manifest, finishMode, selectedPattern, selectedColors, partColorOverrides } = state;
      
      if (!manifest) {
        throw new Error('No manifest loaded');
      }

      // Helper function to get finish name by ID
      const getFinishName = (finishId: string, isPattern: boolean = false): string => {
        if (isPattern) {
          const pattern = manifest.finishModes?.patterns?.options?.find(opt => opt.id === finishId);
          return pattern?.label || finishId;
        } else {
          const color = manifest.finishModes?.colors?.options?.find(opt => opt.id === finishId);
          return color?.label || finishId;
        }
      };

      // Helper function to get part finish
      const getPartFinish = (partId: string): string => {
        // Check for color override first (when in pattern mode)
        if (finishMode === 'patterns' && partColorOverrides[partId]) {
          return getFinishName(partColorOverrides[partId], false);
        }
        
        // If in pattern mode, return pattern name
        if (finishMode === 'patterns' && selectedPattern) {
          return getFinishName(selectedPattern, true);
        }
        
        // Otherwise return color
        const colorId = selectedColors[partId];
        return colorId ? getFinishName(colorId, false) : 'Not specified';
      };
      
      // Capture screenshot
      const canvas = document.querySelector('canvas');
      let screenshot = '';
      
      if (canvas) {
        // Hide UI temporarily
        const itarNotice = document.querySelector('.itar-notice') as HTMLElement;
        const buttons = document.querySelectorAll('button');
        
        const originalDisplay = itarNotice?.style.display;
        const originalButtonDisplays: string[] = [];
        
        if (itarNotice) itarNotice.style.display = 'none';
        buttons.forEach((btn, i) => {
          originalButtonDisplays[i] = btn.style.display;
          btn.style.display = 'none';
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) gl.finish();

        screenshot = canvas.toDataURL('image/png');

        // Restore UI
        if (itarNotice && originalDisplay !== undefined) {
          itarNotice.style.display = originalDisplay;
        }
        buttons.forEach((btn, i) => {
          if (originalButtonDisplays[i] !== undefined) {
            btn.style.display = originalButtonDisplays[i];
          }
        });
      }

      // Prepare configuration data with ALL selections
      const configData = {
        // Part finishes
        receiver_finish: getPartFinish('receiver'),
        barrel_finish: getPartFinish('barrel'),
        stock_finish: getPartFinish('stock'),
        cheek_piece_finish: getPartFinish('cheekPiece'),
        bolt_finish: getPartFinish('boltBody'),
        magazine_finish: getPartFinish('magazine'),
        bipod_finish: getPartFinish('bipodMonopod'),
        handguard_finish: getPartFinish('handguard'),
        muzzle_brake_finish: getPartFinish('muzzleBrake'),
        
        // Pattern/coating name
        pattern_name: finishMode === 'patterns' && selectedPattern 
          ? getFinishName(selectedPattern, true) 
          : 'Custom Individual Colors',
        
        // Hardware selections
        caliber: manifest.calibers?.find((c: any) => c.id === state.selectedCaliber)?.label || 'Not specified',
        
        // Muzzle device (suppressor or muzzle brake)
        muzzle_device: state.selectedSuppressor && state.selectedSuppressor !== 'none'
          ? manifest.suppressors?.find((s: any) => s.id === state.selectedSuppressor)?.label || 'Standard Muzzle Brake'
          : 'Standard Muzzle Brake',
        
        // Trigger (if triggers exist in manifest)
        trigger: (manifest as any).triggers?.find((t: any) => t.id === state.selectedTrigger)?.label || 'Standard Trigger',
        
        // Customer info
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        
        // Email opt-in
        email_opt_in: emailOptIn,
        
        // Screenshot
        screenshot: screenshot,
        
        // Metadata
        configuration_date: new Date().toISOString(),
        finish_mode: finishMode
      };

      console.log('Sending configuration data:', configData);

      // Send to WordPress endpoint
      const response = await fetch('https://cheytac.com/wp-json/configurator/v1/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData)
      });

      const result = await response.json();

      if (result.success) {
        showToast('Configuration saved! Redirecting to product page...', 'success');
        
        // Redirect to M200 product page with config_id
        setTimeout(() => {
          window.location.href = result.redirect_url;
        }, 1500);
      } else {
        throw new Error('Failed to save configuration');
      }

    } catch (error) {
      console.error('Order submission failed:', error);
      showToast('Failed to start order. Please try again.', 'error');
      setIsSubmitting(false);
    }
  };

  // Handle share configuration
  const handleShare = () => {
    setShowShareModal(true);
  };

  // Generate shareable URL and message
  const getShareData = () => {
    const state = useConfigStore.getState();
    const { manifest, finishMode, selectedPattern, selectedColors, partColorOverrides } = state;
    
    if (!manifest) {
      return null;
    }

    // Create a shareable URL with configuration data
    const configString = btoa(JSON.stringify({
      finishMode,
      selectedPattern,
      selectedColors,
      partColorOverrides
    }));
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?config=${configString}`;
    
    // Get pattern/color name for message
    let configDescription = 'custom';
    if (finishMode === 'patterns' && selectedPattern) {
      const pattern = manifest.finishModes?.patterns?.options?.find(opt => opt.id === selectedPattern);
      configDescription = pattern?.label || 'custom pattern';
    } else if (finishMode === 'colors') {
      configDescription = 'custom colors';
    }

    return {
      url: shareUrl,
      title: 'My Custom CheyTac M200',
      text: `Check out my custom M200 with ${configDescription} that I built on CheyTac's configurator!`,
      hashtags: 'CheyTac,M200,CustomRifle'
    };
  };

  // Share to specific platform
  const shareToplatform = (platform: string) => {
    const shareData = getShareData();
    if (!shareData) {
      showToast('No configuration to share', 'error');
      return;
    }

    const { url, text, title, hashtags } = shareData;
    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'pinterest':
        shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n\n' + url)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(`${text}\n\n${url}`);
        showToast('Link copied to clipboard!', 'success');
        setShowShareModal(false);
        return;
      case 'native':
        if (navigator.share) {
          navigator.share({ title, text, url })
            .then(() => {
              showToast('Configuration shared successfully!', 'success');
              setShowShareModal(false);
            })
            .catch((error) => {
              if (error.name !== 'AbortError') {
                console.error('Share failed:', error);
              }
            });
          return;
        }
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
      setShowShareModal(false);
    }
  };

  useEffect(() => {
    loadProductManifest();
    
    // Set responsive camera position and ITAR collapse state
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      
      // Expand ITAR on desktop
      if (!isMobile) {
        setItarCollapsed(false);
      }
      
      // Set camera position based on device - SIDE PROFILE VIEW
      if (isMobile) {
        setCameraPosition([-8, 0.8, 0]); // Side view on mobile - further back
      } else {
        setCameraPosition([-7, 0.8, 0]); // Side view on desktop
      }
    };
    
    handleResize(); // Check initial size
    window.addEventListener('resize', handleResize);
    
    // Load shared configuration from URL if present
    const loadSharedConfig = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const configParam = urlParams.get('config');
      
      if (configParam) {
        try {
          const configData = JSON.parse(atob(configParam));
          const store = useConfigStore.getState();
          
          // Apply the shared configuration
          if (configData.finishMode) {
            store.setFinishMode(configData.finishMode);
          }
          if (configData.selectedPattern) {
            store.selectPattern(configData.selectedPattern);
          }
          if (configData.selectedColors) {
            Object.entries(configData.selectedColors).forEach(([partId, colorId]) => {
              store.selectPartColor(partId, colorId as string);
            });
          }
          if (configData.partColorOverrides) {
            Object.entries(configData.partColorOverrides).forEach(([partId, colorId]) => {
              store.setPartColorOverride(partId, colorId as string);
            });
          }
          
          showToast('Loaded shared configuration!', 'success');
          
          // Clean URL without reloading
          window.history.replaceState({}, '', window.location.pathname);
        } catch (error) {
          console.error('Failed to load shared configuration:', error);
        }
      }
    };
    
    // Load shared config after a short delay to ensure manifest is loaded
    setTimeout(loadSharedConfig, 1000);
    
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
      
      loadManifest(validatedManifest, PRODUCT_PATH);
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
      {/* 3D Model Loading Overlay - Render FIRST */}
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

      <div style={{ 
        pointerEvents: showDisclaimer ? 'none' : 'auto', 
        width: '100%', 
        height: '100%'
      }}>
        <Canvas 
        camera={{ 
          position: cameraPosition, 
          fov: 75,
          near: 0.1,
          far: 1000
        }} 
        gl={{
          logarithmicDepthBuffer: true,
          antialias: window.innerWidth > 768,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance'
        }}
        shadows
        dpr={window.innerWidth <= 768 ? 1 : Math.min(window.devicePixelRatio, 2)}
      >
        <TestModelViewer 
          productPath={PRODUCT_PATH}
          onLoadComplete={() => {
            setModelLoading(false);
            // Only show disclaimer if user hasn't acknowledged it yet
            if (!disclaimerAcknowledged) {
              setShowDisclaimer(true);
            }
          }}
        />
        <LuxuryConfigurator />
        
        {/* Model Preloader - Preloads all suppressor models for instant switching */}
        <ModelPreloader />
        
        {/* Part Click Handler - Click directly on 3D parts to configure */}
        <PartClickHandler />
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
      
      {/* Export, Share, and Order Buttons */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <button
          onClick={() => setShowOrderModal(true)}
          style={{
            background: '#BA2025',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '14px 20px',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(186, 32, 37, 0.4)',
            letterSpacing: '0.5px'
          }}
        >
        START ORDER PROCESS
        </button>
        
        <button
          onClick={handleShare}
          style={{
            background: '#4a4a4a',
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
          Share Configuration
        </button>
        
        <button
          onClick={handleExport}
          style={{
            background: '#4a4a4a',
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
      </div>

      {/* Visualization Disclaimer Modal */}
      {showDisclaimer && (
        <div 
          onClick={(e) => {
            console.log('Background clicked');
            if (e.target === e.currentTarget) {
              console.log('Closing from background click');
              setShowDisclaimer(false);
              setDisclaimerAcknowledged(true);
            }
          }}
          style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px',
          animation: 'fadeIn 0.3s ease-in',
          cursor: 'pointer'
        }}>
          <div 
            className="disclaimer-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '600px',
            width: '100%',
            border: '2px solid #ba2025',
            boxShadow: '0 8px 32px rgba(186, 32, 37, 0.3)',
            animation: 'slideUp 0.4s ease-out',
            cursor: 'default'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '30px'
            }}>
              <img 
                src="/logo.png" 
                alt="CheyTac USA" 
                style={{ 
                  height: '60px', 
                  width: 'auto',
                  marginBottom: '20px'
                }}
              />
              <h2 style={{
                color: '#BA2025',
                fontSize: '24px',
                fontWeight: '700',
                marginBottom: '10px',
                letterSpacing: '0.5px'
              }}>
                VISUALIZATION NOTICE
              </h2>
            </div>

            <div style={{
              color: '#e5e5e5',
              fontSize: '16px',
              lineHeight: '1.6',
              marginBottom: '30px',
              textAlign: 'left'
            }}>
              <p style={{ marginBottom: '15px' }}>
                This configurator is designed for <strong style={{ color: '#BA2025' }}>visualization purposes only</strong>.
              </p>
              
              <p style={{ marginBottom: '15px' }}>
                <strong>Please Note:</strong>
              </p>
              
              <ul style={{ 
                paddingLeft: '20px',
                marginBottom: '15px',
                listStyle: 'disc'
              }}>
                <li style={{ marginBottom: '8px' }}>
                  Each CheyTac M200 rifle is <strong>hand-painted</strong> by skilled craftsmen
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Actual finish patterns and colors <strong>may vary</strong> from digital representations
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Variations in texture, tone, and pattern placement are normal and expected
                </li>
                <li style={{ marginBottom: '8px' }}>
                  This tool provides an <strong>approximate preview</strong> of your configuration
                </li>
              </ul>

              <p style={{ 
                fontSize: '14px',
                color: '#999',
                fontStyle: 'italic'
              }}>
                For exact finish specifications, please contact our sales team.
              </p>
            </div>

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Button MOUSEDOWN - closing modal');
                setShowDisclaimer(false);
                setDisclaimerAcknowledged(true);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Button CLICK');
              }}
              type="button"
              style={{
                width: '100%',
                background: '#BA2025',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                letterSpacing: '0.5px',
                boxShadow: '0 4px 12px rgba(186, 32, 37, 0.4)'
              }}
            >
              I UNDERSTAND — CONTINUE TO CONFIGURATOR
            </button>
          </div>
        </div>
      )}

      {/* Order Process Modal */}
      {showOrderModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              setShowOrderModal(false);
            }
          }}
          style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px',
          animation: 'fadeIn 0.3s ease-in',
          cursor: 'pointer'
        }}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '500px',
            width: '100%',
            border: '2px solid #ba2025',
            boxShadow: '0 8px 32px rgba(186, 32, 37, 0.3)',
            animation: 'slideUp 0.4s ease-out',
            cursor: 'default'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '30px'
            }}>
              <img 
                src="https://cheytac.com/wp-content/uploads/2025/03/cropped-Cheytac-Logos-white.png" 
                alt="CheyTac USA" 
                style={{ 
                  height: '60px', 
                  width: 'auto',
                  marginBottom: '20px'
                }}
              />
              <h2 style={{
                color: '#BA2025',
                fontSize: '24px',
                fontWeight: '700',
                marginBottom: '10px',
                letterSpacing: '0.5px'
              }}>
                START ORDER PROCESS
              </h2>
              <p style={{
                color: '#aaa',
                fontSize: '14px'
              }}>
                We'll save your configuration and contact you to complete your M200 order
              </p>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{
                display: 'block',
                color: '#e5e5e5',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Your Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Doe"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '2px solid #4a4a4a',
                  background: '#2a2a2a',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#BA2025'}
                onBlur={(e) => e.target.style.borderColor = '#4a4a4a'}
              />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{
                display: 'block',
                color: '#e5e5e5',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Email Address *
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '2px solid #4a4a4a',
                  background: '#2a2a2a',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#BA2025'}
                onBlur={(e) => e.target.style.borderColor = '#4a4a4a'}
              />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{
                display: 'block',
                color: '#e5e5e5',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Phone Number *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(555) 123-4567"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '2px solid #4a4a4a',
                  background: '#2a2a2a',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#BA2025'}
                onBlur={(e) => e.target.style.borderColor = '#4a4a4a'}
              />
            </div>

            {/* EMAIL OPT-IN CHECKBOX */}
            <div style={{
              margin: '30px 0 20px 0',
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(186, 32, 37, 0.3)',
              borderRadius: '4px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                cursor: 'pointer',
                color: '#ccc'
              }}>
                <input 
                  type="checkbox" 
                  checked={emailOptIn}
                  onChange={(e) => setEmailOptIn(e.target.checked)}
                  disabled={isSubmitting}
                  style={{
                    width: '20px',
                    height: '20px',
                    marginRight: '15px',
                    marginTop: '3px',
                    accentColor: '#BA2025',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ flex: 1 }}>
                  <strong style={{ color: '#BA2025', fontSize: '16px', display: 'block', marginBottom: '5px' }}>
                    Seize the Distance and Stay Updated!
                  </strong>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>
                    Get exclusive updates on new CheyTac products, limited releases, special offers, and merchandise. 
                    Unsubscribe anytime.
                  </span>
                </span>
              </label>
              
              <p style={{
                margin: '12px 0 0 35px',
                fontSize: '11px',
                color: '#666',
                lineHeight: '1.5'
              }}>
                By checking this box, you consent to receive marketing emails from CheyTac USA. 
                We respect your privacy and never share your information. 
                <a href="https://cheytac.com/privacy-policy" target="_blank" style={{ color: '#BA2025', textDecoration: 'none' }}>
                  Privacy Policy
                </a>
              </p>
            </div>

            {/* BUTTONS */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  if (!isSubmitting) {
                    setShowOrderModal(false);
                    setCustomerName('');
                    setCustomerEmail('');
                    setCustomerPhone('');
                    setEmailOptIn(false);
                  }
                }}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  background: '#4a4a4a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleStartOrder}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  background: isSubmitting ? '#8B1519' : '#BA2025',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 12px rgba(186, 32, 37, 0.4)'
                }}
              >
                {isSubmitting ? 'Processing...' : 'Continue to Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowShareModal(false);
            }
          }}
          style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px',
          animation: 'fadeIn 0.3s ease-in',
          cursor: 'pointer'
        }}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '450px',
            width: '100%',
            border: '2px solid #ba2025',
            boxShadow: '0 8px 32px rgba(186, 32, 37, 0.3)',
            animation: 'slideUp 0.4s ease-out',
            cursor: 'default'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '30px'
            }}>
              <img 
                src="/logo.png" 
                alt="CheyTac USA" 
                style={{ 
                  height: '60px', 
                  width: 'auto',
                  marginBottom: '20px'
                }}
              />
              <h2 style={{
                color: '#BA2025',
                fontSize: '24px',
                fontWeight: '700',
                marginBottom: '10px',
                letterSpacing: '0.5px'
              }}>
                SHARE CONFIGURATION
              </h2>
              <p style={{
                color: '#aaa',
                fontSize: '14px'
              }}>
                Share your custom M200 build
              </p>
            </div>

            {/* Social Media Buttons Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <button
                onClick={() => shareToplatform('facebook')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#BA2025';
                  e.currentTarget.style.borderColor = '#BA2025';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                Facebook
              </button>

              <button
                onClick={() => shareToplatform('twitter')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#BA2025';
                  e.currentTarget.style.borderColor = '#BA2025';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                Twitter / X
              </button>

              <button
                onClick={() => shareToplatform('linkedin')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#BA2025';
                  e.currentTarget.style.borderColor = '#BA2025';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                LinkedIn
              </button>

              <button
                onClick={() => shareToplatform('pinterest')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#BA2025';
                  e.currentTarget.style.borderColor = '#BA2025';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                Pinterest
              </button>

              <button
                onClick={() => shareToplatform('whatsapp')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#BA2025';
                  e.currentTarget.style.borderColor = '#BA2025';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                WhatsApp
              </button>

              <button
                onClick={() => shareToplatform('email')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#BA2025';
                  e.currentTarget.style.borderColor = '#BA2025';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                Email
              </button>
            </div>

            {/* Copy Link Button */}
            <button
              onClick={() => shareToplatform('copy')}
              style={{
                width: '100%',
                background: '#BA2025',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                marginBottom: '12px',
                letterSpacing: '0.5px',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: '0 4px 12px rgba(186, 32, 37, 0.4)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#9a1a1f'}
              onMouseOut={(e) => e.currentTarget.style.background = '#BA2025'}
            >
              Copy Link to Clipboard
            </button>

            {/* Native Share (if available) */}
            {navigator.share && (
              <button
                onClick={() => shareToplatform('native')}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#BA2025';
                  e.currentTarget.style.borderColor = '#BA2025';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                More Share Options
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={() => setShowShareModal(false)}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#888',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            >
              Cancel
            </button>
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
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
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
        
        /* Mobile responsive fix - prevents ITAR notice and buttons overlap */
        @media (max-width: 768px) {
          .itar-notice {
            bottom: 190px !important;
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
        
        /* Mobile styles for disclaimer modal */
        @media (max-width: 600px) {
          .disclaimer-modal-content {
            padding: 30px 20px !important;
            font-size: 14px !important;
          }
          
          .disclaimer-modal-content h2 {
            font-size: 20px !important;
          }
          
          .disclaimer-modal-content img {
            height: 50px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
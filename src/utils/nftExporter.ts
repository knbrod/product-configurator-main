// src/utils/nftExporter.ts - Simplified version that skips problematic image capture
import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';

export interface NFTExportData {
  modelFile: Blob;
  previewImages: {
    main: string;
    front: string;
    side: string;
    back: string;
    isometric: string;
  };
  metadata: NFTMetadata;
  configurationData: any;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  animation_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    model_format: string;
    configuration_id: string;
    created_at: string;
    creator: string;
    file_size?: number;
  };
}

export class NFTExporter {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private model: THREE.Group | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
  }

  setModel(model: THREE.Group) {
    this.model = model;
    console.log('Model set for NFT export:', {
      name: model.name || 'unnamed',
      type: model.type,
      children: model.children.length
    });
  }

  async exportNFTPackage(
    configurationData: any, 
    userAddress?: string
  ): Promise<NFTExportData> {
    if (!this.model) {
      throw new Error('No model set for export');
    }

    console.log('Starting 3D NFT export process...');

    // 1. Export the 3D model as GLB
    const modelFile = await this.export3DModel();
    
    // 2. Create placeholder preview images (skip problematic canvas capture)
    const previewImages = this.createPlaceholderImages();
    
    // 3. Generate NFT metadata
    const metadata = this.generateMetadata(configurationData, previewImages.main, userAddress);
    
    // 4. Update metadata with actual file size
    metadata.properties.file_size = modelFile.size;
    
    // 5. Prepare the complete NFT package
    const nftPackage: NFTExportData = {
      modelFile,
      previewImages,
      metadata,
      configurationData
    };

    console.log('3D NFT export complete. Model size:', modelFile.size, 'bytes');
    return nftPackage;
  }

  private async export3DModel(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter();
      
      if (!this.model) {
        reject(new Error('No model to export'));
        return;
      }

      console.log('Exporting model with GLTFExporter...');
      
      // Clone the model to avoid modifying the original
      const modelClone = this.model.clone();
      
      // Log some details about what we're exporting
      let meshCount = 0;
      modelClone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshCount++;
        }
      });
      console.log('Exporting', meshCount, 'meshes in model');
      
      exporter.parse(
        modelClone,
        (result) => {
          let blob: Blob;
          
          if (result instanceof ArrayBuffer) {
            blob = new Blob([result], { type: 'model/gltf-binary' });
            console.log('GLB export successful - ArrayBuffer size:', result.byteLength);
          } else {
            const jsonString = JSON.stringify(result);
            blob = new Blob([jsonString], { type: 'application/json' });
            console.log('GLTF export successful - JSON size:', jsonString.length);
          }
          
          console.log('3D Model exported successfully, final blob size:', blob.size);
          resolve(blob);
        },
        (error) => {
          console.error('Error exporting 3D model:', error);
          reject(error);
        },
        {
          binary: true, // Export as GLB (binary)
          includeCustomExtensions: true,
          animations: [],
          truncateDrawRange: true
        }
      );
    });
  }

  // Simple placeholder image creation (no canvas capture)
  private createPlaceholderImages(): {
    main: string;
    front: string;
    side: string;
    back: string;
    isometric: string;
  } {
    console.log('Creating placeholder preview images...');
    
    const createPlaceholder = (viewName: string): string => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#f0f0f0');
        gradient.addColorStop(1, '#e0e0e0');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Border
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 510, 510);
        
        // CheyTac logo area
        ctx.fillStyle = '#ba2025';
        ctx.fillRect(50, 50, 412, 100);
        
        // Text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CHEYTAC', 256, 110);
        
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('M200 Configuration', 256, 200);
        
        ctx.font = '20px Arial';
        ctx.fillText(`${viewName} View`, 256, 250);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText('3D Interactive NFT', 256, 300);
        ctx.fillText('Configuration Preview', 256, 325);
        
        // Bottom info
        ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 256, 420);
        ctx.fillText('View full 3D model in NFT viewer', 256, 450);
      }
      
      return canvas.toDataURL('image/png', 0.9);
    };

    return {
      main: createPlaceholder('Main'),
      front: createPlaceholder('Front'),
      side: createPlaceholder('Side'),
      back: createPlaceholder('Back'),
      isometric: createPlaceholder('Isometric')
    };
  }

  private generateMetadata(
    configurationData: any, 
    mainImageDataURL: string, 
    userAddress?: string
  ): NFTMetadata {
    const configId = this.generateConfigurationId(configurationData);
    const timestamp = new Date().toISOString();

    // Extract configuration attributes for NFT traits
    const attributes: Array<{ trait_type: string; value: string }> = [];
    
    // Add configuration-specific traits
    if (configurationData.selectedOptions) {
      Object.entries(configurationData.selectedOptions).forEach(([key, value]) => {
        attributes.push({
          trait_type: key.replace(/([A-Z])/g, ' $1').trim(), // Convert camelCase to readable
          value: String(value)
        });
      });
    }

    // Add general traits
    attributes.push(
      { trait_type: 'Model Type', value: 'CheyTac M200' },
      { trait_type: 'Format', value: '3D Interactive' },
      { trait_type: 'Export Date', value: timestamp.split('T')[0] },
      { trait_type: 'Blockchain', value: 'Polygon' }
    );

    const metadata: NFTMetadata = {
      name: `CheyTac M200 Configuration #${configId.slice(0, 8)}`,
      description: `A unique 3D interactive configuration of the CheyTac M200 precision rifle system. This NFT includes the full 3D model with your custom configuration, viewable in AR/VR and 3D applications. Configuration ID: ${configId}`,
      image: mainImageDataURL, // Main preview image
      animation_url: '', // Will be set to the 3D model URL after IPFS upload
      attributes,
      properties: {
        model_format: 'GLB',
        configuration_id: configId,
        created_at: timestamp,
        creator: userAddress || 'Unknown',
        file_size: 0 // Will be updated after model export
      }
    };

    return metadata;
  }

  private generateConfigurationId(configurationData: any): string {
    // Create a unique hash based on the configuration
    const configString = JSON.stringify(configurationData);
    let hash = 0;
    
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16) + Date.now().toString(16);
  }

  // Utility method to download the NFT package locally (for testing)
  downloadNFTPackage(nftPackage: NFTExportData) {
    // Download 3D model
    const modelURL = URL.createObjectURL(nftPackage.modelFile);
    const modelLink = document.createElement('a');
    modelLink.href = modelURL;
    modelLink.download = `CheyTac-M200-${nftPackage.metadata.properties.configuration_id}.glb`;
    modelLink.click();

    // Download metadata
    const metadataBlob = new Blob([JSON.stringify(nftPackage.metadata, null, 2)], {
      type: 'application/json'
    });
    const metadataURL = URL.createObjectURL(metadataBlob);
    const metadataLink = document.createElement('a');
    metadataLink.href = metadataURL;
    metadataLink.download = `metadata-${nftPackage.metadata.properties.configuration_id}.json`;
    metadataLink.click();

    // Download preview images
    Object.entries(nftPackage.previewImages).forEach(([angle, dataURL]) => {
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `preview-${angle}-${nftPackage.metadata.properties.configuration_id}.png`;
      link.click();
    });

    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(modelURL);
      URL.revokeObjectURL(metadataURL);
    }, 1000);
  }
}

// IPFS Upload utility (placeholder - will need actual IPFS service)
export class IPFSUploader {
  private pinataApiKey?: string;
  private pinataSecretKey?: string;

  constructor(pinataApiKey?: string, pinataSecretKey?: string) {
    this.pinataApiKey = pinataApiKey;
    this.pinataSecretKey = pinataSecretKey;
  }

  async uploadNFTPackage(nftPackage: NFTExportData): Promise<{
    modelIPFSHash: string;
    metadataIPFSHash: string;
    imageIPFSHashes: { [key: string]: string };
  }> {
    // This is a placeholder implementation
    // In production, you'd integrate with Pinata, Infura IPFS, or your preferred IPFS service
    
    console.log('Uploading NFT package to IPFS...');
    
    // Simulate upload process
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          modelIPFSHash: 'QmExample3DModelHash' + Date.now(),
          metadataIPFSHash: 'QmExampleMetadataHash' + Date.now(),
          imageIPFSHashes: {
            main: 'QmExampleMainImageHash' + Date.now(),
            front: 'QmExampleFrontImageHash' + Date.now(),
            side: 'QmExampleSideImageHash' + Date.now(),
            back: 'QmExampleBackImageHash' + Date.now(),
            isometric: 'QmExampleIsoImageHash' + Date.now()
          }
        });
      }, 2000);
    });
  }
}

// Smart Contract Interface (placeholder)
export class NFTMinter {
  private contractAddress: string;
  private web3Provider: any;

  constructor(contractAddress: string, web3Provider?: any) {
    this.contractAddress = contractAddress;
    this.web3Provider = web3Provider;
  }

  async mintNFT(
    recipientAddress: string,
    metadataIPFSHash: string,
    modelIPFSHash: string
  ): Promise<string> {
    // Placeholder for smart contract interaction
    console.log('Minting NFT with metadata:', metadataIPFSHash);
    console.log('Model hash:', modelIPFSHash);
    console.log('Recipient:', recipientAddress);
    
    // Simulate transaction
    return new Promise((resolve) => {
      setTimeout(() => {
        const txHash = '0x' + Math.random().toString(16).substr(2, 64);
        resolve(txHash);
      }, 3000);
    });
  }
}
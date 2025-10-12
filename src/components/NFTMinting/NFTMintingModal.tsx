// src/components/NFTMinting/NFTMintingModal.tsx
import React, { useState, useEffect } from 'react';
import { Web3Service } from '../../services/web3Service';

// Define the NFTExportData interface locally to avoid import issues
interface NFTExportData {
  modelFile: Blob;
  previewImages: {
    main: string;
    front: string;
    side: string;
    back: string;
    isometric: string;
  };
  metadata: {
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
  };
  configurationData: any;
}

interface NFTMintingModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftData: NFTExportData | null;
  onMintSuccess: (tokenId: string, txHash: string) => void;
}

export function NFTMintingModal({ isOpen, onClose, nftData, onMintSuccess }: NFTMintingModalProps) {
  const [web3Service] = useState(new Web3Service());
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [minting, setMinting] = useState(false);
  const [uploadingToIPFS, setUploadingToIPFS] = useState(false);
  const [ipfsHashes, setIpfsHashes] = useState<any>(null);
  const [mintingStep, setMintingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkWalletConnection();
    }
  }, [isOpen]);

  const checkWalletConnection = async () => {
    try {
      const address = await web3Service.getWalletAddress();
      if (address) {
        setWalletAddress(address);
        await updateWalletInfo();
      }
    } catch (error) {
      console.error('Failed to check wallet connection:', error);
    }
  };

  const connectWallet = async () => {
    console.log('Connect wallet button clicked');
    try {
      setError(null);
      console.log('Calling web3Service.connectWallet()...');
      const address = await web3Service.connectWallet();
      console.log('Wallet connection result:', address);
      setWalletAddress(address);
      await updateWalletInfo();
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      setError(error.message);
    }
  };

  const updateWalletInfo = async () => {
    try {
      const [balance, info] = await Promise.all([
        web3Service.getWalletBalance(),
        web3Service.getContractInfo()
      ]);
      setWalletBalance(balance);
      setContractInfo(info);
    } catch (error) {
      console.error('Failed to update wallet info:', error);
    }
  };

  // Simulate IPFS upload (replace with real implementation)
  const uploadToIPFS = async (nftData: NFTExportData): Promise<any> => {
    setUploadingToIPFS(true);
    setMintingStep('Uploading to IPFS...');
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // In production, upload to Pinata/IPFS here
    const mockHashes = {
      metadataHash: `QmMeta${Date.now()}`,
      modelHash: `QmModel${Date.now()}`,
      imageHash: `QmImage${Date.now()}`
    };
    
    setUploadingToIPFS(false);
    return mockHashes;
  };

  const handleMint = async () => {
    if (!nftData || !walletAddress) return;

    setMinting(true);
    setError(null);
    
    try {
      // Step 1: Upload to IPFS
      setMintingStep('Uploading files to IPFS...');
      const hashes = await uploadToIPFS(nftData);
      setIpfsHashes(hashes);
      
      // Step 2: Prepare URIs
      const metadataURI = `https://gateway.pinata.cloud/ipfs/${hashes.metadataHash}`;
      const modelURI = `https://gateway.pinata.cloud/ipfs/${hashes.modelHash}`;
      
      // Step 3: Mint NFT
      setMintingStep('Minting your CheyTac NFT...');
      const result = await web3Service.mintNFT(
        metadataURI,
        modelURI,
        nftData.metadata.properties.configuration_id,
        walletAddress
      );
      
      setMintingStep('NFT minted successfully!');
      onMintSuccess(result.tokenId, result.transactionHash);
      
      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error: any) {
      setError(error.message);
      setMintingStep('');
    } finally {
      setMinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
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
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '2px solid #ba2025',
          paddingBottom: '15px'
        }}>
          <h2 style={{ margin: 0, color: '#ba2025' }}>Mint CheyTac NFT</h2>
          <button
            onClick={onClose}
            disabled={minting}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: minting ? 'not-allowed' : 'pointer',
              color: '#999'
            }}
          >
            ×
          </button>
        </div>

        {/* Wallet Connection */}
        {!walletAddress ? (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Connect your wallet to mint your configured CheyTac M200 as an NFT
            </p>
            <button
              onClick={connectWallet}
              style={{
                background: '#ba2025',
                color: 'black',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {/* Wallet Info */}
            <div style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <strong>Wallet:</strong> {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <strong>Balance:</strong> {parseFloat(walletBalance).toFixed(4)} MATIC
              </div>
              {contractInfo && (
                <div style={{ fontSize: '14px', color: '#666' }}>
                  <strong>Mint Price:</strong> {contractInfo.mintPrice} MATIC (~$0.001)
                </div>
              )}
            </div>

            {/* NFT Preview */}
            {nftData && (
              <div style={{
                background: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Your NFT</h3>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                  <strong>Name:</strong> {nftData.metadata.name}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                  <strong>Configuration ID:</strong> {nftData.metadata.properties.configuration_id.slice(0, 12)}...
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                  <strong>Includes:</strong> 3D Model ({Math.round(nftData.modelFile.size / 1024)}KB) + 5 Preview Images
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  <strong>Traits:</strong> {nftData.metadata.attributes.length} configuration attributes
                </div>
              </div>
            )}

            {/* Minting Status */}
            {(minting || mintingStep) && (
              <div style={{
                background: '#e3f2fd',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {minting && (
                  <div style={{ marginBottom: '10px' }}>
                    <div className="spinner" style={{ 
                      width: '20px', 
                      height: '20px',
                      margin: '0 auto 10px'
                    }} />
                  </div>
                )}
                <div style={{ color: '#1976d2', fontWeight: '600' }}>
                  {mintingStep}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div style={{
                background: '#ffebee',
                color: '#c62828',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Mint Button */}
            <button
              onClick={handleMint}
              disabled={minting || !nftData}
              style={{
                background: minting ? '#999999' : '#ba2025',
                color: 'black',
                border: 'none',
                padding: '15px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: minting ? 'not-allowed' : 'pointer',
                width: '100%',
                marginBottom: '15px'
              }}
            >
              {minting ? 'Minting...' : `Mint NFT (${contractInfo?.mintPrice || '0.001'} MATIC)`}
            </button>

            {/* Info */}
            <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
              Your NFT will be minted on Polygon network with extremely low gas fees.
              <br />
              This creates a permanent, tradeable digital asset of your configuration.
            </div>
          </>
        )}

        {/* CSS for spinner */}
        <style>{`
          .spinner {
            border: 2px solid #f3f3f3;
            border-top: 2px solid #ba2025;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
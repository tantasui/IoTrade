import axios from 'axios';
import crypto from 'crypto-js';
import dotenv from 'dotenv';
import { WalrusUploadResponse, SealEncryptionResult } from '../types';
import sealService from './seal.service';

// Ensure environment variables from .env are loaded before using process.env
dotenv.config();

export class WalrusService {
  private publisherUrl: string;
  private aggregatorUrl: string;
  private epochs: number;

  constructor() {
    this.publisherUrl = process.env.WALRUS_PUBLISHER_URL || 'https://suiftly-testnet-pub.mhax.io';
    this.aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://suiftly-testnet-agg.mhax.io';
    this.epochs = parseInt(process.env.WALRUS_EPOCHS || '1');

    console.log('[WalrusService] Config', {
      publisherUrl: this.publisherUrl,
      aggregatorUrl: this.aggregatorUrl,
      epochs: this.epochs,
    });
  }

  /**
   * Upload data to Walrus storage
   * @param data - Data to upload
   * @param encrypt - Whether to encrypt (for premium feeds, uses Seal)
   * @param feedId - Feed ID (required if encrypt is true, for Seal identity)
   */
  async uploadData(data: any, encrypt: boolean = false, feedId?: string): Promise<string> {
    try {
      let dataToUpload: string | Uint8Array;

      // Convert data to string if it's an object
      if (typeof data === 'object') {
        dataToUpload = JSON.stringify(data);
      } else {
        dataToUpload = data;
      }

      // SECURITY: Encrypt data BEFORE upload to Walrus
      // Walrus is decentralized storage - anyone with blob ID can access data
      // Encryption is the ONLY protection for premium feeds
      if (encrypt) {
        if (!feedId) {
          throw new Error('feedId is required for Seal encryption');
        }
        
        if (!sealService.isConfigured()) {
          throw new Error('Seal encryption is not configured. Please set SUI_PACKAGE_ID and SEAL_KEY_SERVER_OBJECT_IDS in environment variables. Premium feeds cannot be uploaded without encryption.');
        }
        
        try {
          // CRITICAL: Encryption happens HERE, BEFORE upload
          // This ensures only encrypted bytes are stored in Walrus
          const { encryptedBytes } = await sealService.encryptData(dataToUpload, feedId);
          
          // Replace plaintext with encrypted bytes
          // Only encrypted bytes will be uploaded to Walrus
          dataToUpload = encryptedBytes;
          
          const originalSize = typeof dataToUpload === 'string' 
            ? Buffer.byteLength(dataToUpload, 'utf8')
            : (dataToUpload as Uint8Array).length;
          
          console.log('[WalrusService] 🔒 Data encrypted with Seal BEFORE upload', { 
            feedId, 
            originalSize,
            encryptedSize: encryptedBytes.length 
          });
        } catch (sealError: any) {
          console.error('[WalrusService] ❌ Seal encryption failed:', sealError.message);
          // SECURITY: Fail securely - do NOT upload unencrypted premium data
          throw new Error(`Seal encryption failed: ${sealError.message}. Premium feeds MUST be encrypted before upload to Walrus. Upload aborted.`);
        }
      }

      // Upload to Walrus (use current HTTP API path)
      const uploadUrl = `${this.publisherUrl}/v1/blobs?epochs=${this.epochs}`;
      const contentLength = typeof dataToUpload === 'string' 
        ? Buffer.byteLength(dataToUpload, 'utf8') 
        : dataToUpload.length;
      console.log('[WalrusService] Upload start', { uploadUrl, epochs: this.epochs, encrypt, contentLength });

      // Convert Uint8Array to Buffer if needed
      const uploadData = typeof dataToUpload === 'string' 
        ? dataToUpload 
        : Buffer.from(dataToUpload);

      const response = await axios.put(
        uploadUrl,
        uploadData,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        }
      );

      // Extract blob ID from response
      let blobId: string | undefined;
      const dataKeys = response && response.data ? Object.keys(response.data) : [];
      console.log('[WalrusService] Upload response', { status: response.status, dataKeys });

      // Support multiple response shapes across Walrus versions
      try {
        if (response.data?.blobStoreResult?.newlyCreated?.blobObject?.id) {
          blobId = response.data.blobStoreResult.newlyCreated.blobObject.id;
        } else if (response.data?.blobStoreResult?.alreadyCertified?.blobId) {
          blobId = response.data.blobStoreResult.alreadyCertified.blobId;
        } else if (response.data?.newlyCreated?.blobObject?.blobId) {
          blobId = response.data.newlyCreated.blobObject.blobId;
        } else if (response.data?.newlyCreated?.blobObject?.id) {
          blobId = response.data.newlyCreated.blobObject.id;
        } else if (response.data?.alreadyCertified?.blobId) {
          blobId = response.data.alreadyCertified.blobId;
        } else if (response.data?.blobId) {
          blobId = response.data.blobId;
        }
      } catch (parseErr) {
        console.warn('[WalrusService] Unexpected Walrus response shape', parseErr);
      }

      if (!blobId) {
        console.error('[WalrusService] Failed to parse Walrus upload response', response.data);
        throw new Error('Failed to get blob ID from Walrus response');
      }

      console.log(`Data uploaded to Walrus with blob ID: ${blobId}`);
      return blobId;
    } catch (error: any) {
      const status = error?.response?.status;
      const respData = error?.response?.data;
      console.error('Error uploading to Walrus:', error.message, { status, respData });
      throw new Error(`Walrus upload failed: ${error.message}`);
    }
  }

  /**
   * Retrieve data from Walrus storage
   * @param blobId - Blob ID to retrieve
   * @param decryptionKey - Optional decryption key (deprecated, not used for Seal)
   * @param feedId - Optional feed ID (required for Seal-encrypted premium feeds)
   * @returns Data (encrypted bytes for Seal-encrypted premium feeds, plain data for non-premium)
   */
  async retrieveData(blobId: string, decryptionKey?: string, feedId?: string): Promise<any> {
    try {
      const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`;
      const isPremiumFeed = feedId && sealService.isConfigured();
      console.log('[WalrusService] Retrieve start', { url, feedId, sealConfigured: sealService.isConfigured(), isPremiumFeed });
      
      // For premium feeds, always try arraybuffer first to get raw bytes
      // This handles both Seal-encrypted bytes and JSON stored as bytes
      let response;
      try {
        response = await axios.get(url, { 
          responseType: isPremiumFeed ? 'arraybuffer' : 'text' 
        });
      } catch (arrayBufferError: any) {
        // If arraybuffer fails, try as text (fallback)
        console.warn('[WalrusService] ArrayBuffer request failed, trying text', { error: arrayBufferError.message });
        response = await axios.get(url, { responseType: 'text' });
      }

      // Handle ArrayBuffer response (for premium feeds expecting Seal bytes)
      if (response.data instanceof ArrayBuffer || Buffer.isBuffer(response.data)) {
        const buffer = response.data instanceof ArrayBuffer 
          ? new Uint8Array(response.data)
          : new Uint8Array(response.data);
        
        // For premium feeds, data must be Seal-encrypted bytes
        if (isPremiumFeed) {
          console.log('[WalrusService] Retrieved Seal-encrypted bytes for premium feed', { feedId, size: buffer.length });
          return buffer;
        }
        
        // For non-premium feeds, try to decode as text/JSON
        try {
          const textDecoder = new TextDecoder('utf-8', { fatal: false });
          const decodedString = textDecoder.decode(buffer);
          
          if (decodedString.trim().startsWith('{') || decodedString.trim().startsWith('[')) {
            try {
              return JSON.parse(decodedString);
            } catch (jsonError) {
              // Not valid JSON, return as string
              return decodedString;
            }
          }
          return decodedString;
        } catch (decodeError) {
          // If decoding fails, return as binary
          return buffer;
        }
      }

      // Handle string/text response
      let data = typeof response.data === 'string' ? response.data : response.data.toString();
      
      // For premium feeds, we should never get text - it must be Seal-encrypted bytes
      if (isPremiumFeed) {
        console.error('[WalrusService] Premium feed returned text instead of Seal-encrypted bytes. This indicates the data was not properly encrypted with Seal.', { feedId });
        throw new Error('Premium feed data must be Seal-encrypted. Received text instead of encrypted bytes. Data may need to be re-uploaded with Seal encryption.');
      }

      // For non-premium feeds, parse as JSON if possible
      try {
        return JSON.parse(data);
      } catch (e) {
        // If not JSON, return as is
        return data;
      }
    } catch (error: any) {
      const status = error?.response?.status;
      console.error('[WalrusService] Error retrieving from Walrus:', error.message, { status, feedId });
      throw new Error(`Walrus retrieval failed: ${error.message}`);
    }
  }

  /**
   * Seal encryption implementation for premium feeds
   * This is a simplified version - in production, use proper Seal encryption library
   */
  async encryptData(
    data: any,
    accessList: string[]
  ): Promise<SealEncryptionResult> {
    try {
      const dataString = typeof data === 'object' ? JSON.stringify(data) : data;

      // Generate master encryption key
      const masterKey = this.generateEncryptionKey();

      // Encrypt the actual data with master key
      const encryptedData = this.encryptWithKey(dataString, masterKey);

      // Create access keys for each authorized address
      const accessKeys: { [address: string]: string } = {};

      for (const address of accessList) {
        // In real Seal encryption, we'd use public key encryption
        // For this demo, we'll use a derived key
        const addressKey = this.deriveKeyForAddress(masterKey, address);
        accessKeys[address] = addressKey;
      }

      return {
        encryptedData,
        accessKeys
      };
    } catch (error: any) {
      console.error('Error encrypting data:', error.message);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt Seal-encrypted data
   */
  async decryptSealData(
    encryptedData: string,
    accessKey: string,
    userAddress: string
  ): Promise<any> {
    try {
      // Derive the master key from the access key
      const masterKey = this.deriveMasterKeyFromAccessKey(accessKey, userAddress);

      // Decrypt the data
      const decrypted = this.decryptWithKey(encryptedData, masterKey);

      return JSON.parse(decrypted);
    } catch (error: any) {
      console.error('Error decrypting data:', error.message);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  // =================== Helper Methods ===================

  private generateEncryptionKey(): string {
    return crypto.lib.WordArray.random(32).toString();
  }

  private encryptWithKey(data: string, key: string): string {
    return crypto.AES.encrypt(data, key).toString();
  }

  private decryptWithKey(encryptedData: string, key: string): string {
    const bytes = crypto.AES.decrypt(encryptedData, key);
    return bytes.toString(crypto.enc.Utf8);
  }

  private deriveKeyForAddress(masterKey: string, address: string): string {
    // Create a deterministic key for the address
    return crypto.HmacSHA256(address, masterKey).toString();
  }

  private deriveMasterKeyFromAccessKey(accessKey: string, userAddress: string): string {
    // In this simplified version, we reverse the derivation
    // In real Seal, this would use asymmetric cryptography
    return accessKey; // Simplified for demo
  }

  /**
   * Check if blob exists in Walrus
   */
  async blobExists(blobId: string): Promise<boolean> {
    try {
      await axios.head(`${this.aggregatorUrl}/v1/blobs/${blobId}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get blob info (metadata)
   */
  async getBlobInfo(blobId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.aggregatorUrl}/v1/blobs/${blobId}`, {
        headers: { 'Accept': 'application/json' },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error getting blob info:', error.message);
      throw new Error(`Failed to get blob info: ${error.message}`);
    }
  }
}

export default new WalrusService();

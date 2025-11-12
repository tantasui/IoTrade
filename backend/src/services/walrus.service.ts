import axios from 'axios';
import crypto from 'crypto-js';
import dotenv from 'dotenv';
import { WalrusUploadResponse, SealEncryptionResult } from '../types';

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
   */
  async uploadData(data: any, encrypt: boolean = false): Promise<string> {
    try {
      let dataToUpload = data;

      // Convert data to string if it's an object
      if (typeof data === 'object') {
        dataToUpload = JSON.stringify(data);
      }

      // Encrypt data if requested
      if (encrypt) {
        const encryptionKey = this.generateEncryptionKey();
        dataToUpload = this.encryptWithKey(dataToUpload, encryptionKey);
        // Store encryption key separately (in production, use proper key management)
        dataToUpload = JSON.stringify({
          encrypted: true,
          data: dataToUpload,
          keyHint: encryptionKey.substring(0, 8) // Store hint for testing
        });
      }

      // Upload to Walrus (use current HTTP API path)
      const uploadUrl = `${this.publisherUrl}/v1/blobs?epochs=${this.epochs}`;
      const contentLength = typeof dataToUpload === 'string' ? Buffer.byteLength(dataToUpload, 'utf8') : 0;
      console.log('[WalrusService] Upload start', { uploadUrl, epochs: this.epochs, encrypt, contentLength });

      const response = await axios.put(
        uploadUrl,
        dataToUpload,
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
   */
  async retrieveData(blobId: string, decryptionKey?: string): Promise<any> {
    try {
      const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`;
      console.log('[WalrusService] Retrieve start', { url });
      const response = await axios.get(url, { responseType: 'text' });

      let data = response.data;

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(data);

        // Check if data is encrypted
        if (parsed.encrypted && decryptionKey) {
          const decrypted = this.decryptWithKey(parsed.data, decryptionKey);
          return JSON.parse(decrypted);
        }

        return parsed;
      } catch (e) {
        // If not JSON, return as is
        return data;
      }
    } catch (error: any) {
      const status = error?.response?.status;
      console.error('Error retrieving from Walrus:', error.message, { status });
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

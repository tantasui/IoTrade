import { SealClient } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import * as dotenv from 'dotenv';

dotenv.config();

export class SealService {
  private client: SealClient;
  private suiClient: SuiClient;
  private packageId: string;
  private keyServerObjectIds: string[];

  constructor() {
    const network = process.env.SUI_NETWORK || 'testnet';
    const fullnodeUrl = process.env.SUI_FULLNODE_URL || getFullnodeUrl(network as any);
    this.suiClient = new SuiClient({ url: fullnodeUrl });
    this.packageId = process.env.SUI_PACKAGE_ID || '';

    // Use verified Seal key server object IDs for Testnet
    // These are the official Seal key server object IDs
    // Format: array of object IDs (not URLs)
    const keyServerIds = process.env.SEAL_KEY_SERVER_OBJECT_IDS;
    this.keyServerObjectIds = keyServerIds
      ? keyServerIds.split(',')
      : [
          '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
          '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
        ];

    this.client = new SealClient({
      suiClient: this.suiClient as any, // Type compatibility workaround
      serverConfigs: this.keyServerObjectIds.map((id) => ({
        objectId: id,
        weight: 1,
      })),
      verifyKeyServers: false,
    });

    console.log('[SealService] Initialized', {
      packageId: this.packageId || 'NOT SET',
      packageIdLength: this.packageId?.length || 0,
      keyServers: this.keyServerObjectIds.length,
      network,
      isConfigured: !!this.packageId && this.keyServerObjectIds.length > 0,
    });
  }

  /**
   * Encrypt data using Seal IBE encryption
   * @param data - Data to encrypt (will be JSON stringified if object)
   * @param feedId - Feed ID to use as Seal identity
   * @returns Encrypted bytes and backup key
   */
  async encryptData(data: any, feedId: string): Promise<{ encryptedBytes: Uint8Array; backupKey: Uint8Array }> {
    try {
      // Convert data to bytes
      let dataBytes: Uint8Array;
      if (typeof data === 'string') {
        dataBytes = new TextEncoder().encode(data);
      } else {
        dataBytes = new TextEncoder().encode(JSON.stringify(data));
      }

      // Encrypt using Seal
      // Seal identity format: [package_id][feed_id]
      // Seal automatically prefixes with package ID, so we only pass feed_id
      // Both packageId and id should be hex strings (not bytes)
      const result = await this.client.encrypt({
        threshold: 2, // Require 2 key servers to decrypt
        packageId: this.packageId, // Pass hex string directly
        id: feedId.replace('0x', ''), // Pass hex string (without 0x prefix)
        data: dataBytes,
      });

      console.log('[SealService] Data encrypted', {
        feedId,
        dataSize: dataBytes.length,
        encryptedSize: result.encryptedObject.length,
      });

      return {
        encryptedBytes: result.encryptedObject,
        backupKey: result.key,
      };
    } catch (error: any) {
      console.error('[SealService] Encryption error:', error);
      throw new Error(`Seal encryption failed: ${error.message}`);
    }
  }

  /**
   * Get Seal identity for a feed
   * Identity format: [package_id][feed_id]
   */
  getSealIdentity(feedId: string): string {
    // Seal automatically prefixes with package ID
    // So we just return the feed ID
    return feedId;
  }

  /**
   * Check if Seal is properly configured
   */
  isConfigured(): boolean {
    return !!this.packageId && this.keyServerObjectIds.length > 0;
  }

  /**
   * Get the package ID
   */
  getPackageId(): string {
    return this.packageId;
  }

  /**
   * Get key server object IDs
   */
  getKeyServerObjectIds(): string[] {
    return this.keyServerObjectIds;
  }
}

export default new SealService();


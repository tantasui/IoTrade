import { SealClient, SessionKey, EncryptedObject, NoAccessError, type ExportedSessionKey } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromHEX } from '@mysten/sui/utils';
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

  /**
   * Decrypt Seal-encrypted data using a session key
   * This allows the backend to decrypt data on behalf of users who have provided a session key
   * @param encryptedData - Base64 encoded encrypted bytes
   * @param feedId - Feed ID (used as Seal identity)
   * @param subscriptionId - Subscription object ID (for access policy verification)
   * @param sessionKey - Exported session key from the user
   * @param consumerAddress - Consumer wallet address
   * @returns Decrypted data
   */
  async decryptData(
    encryptedData: string,
    feedId: string,
    subscriptionId: string,
    sessionKey: ExportedSessionKey,
    consumerAddress: string
  ): Promise<any> {
    try {
      if (!this.isConfigured()) {
        throw new Error('Seal is not configured');
      }

      // Convert base64 to Uint8Array
      const encryptedBytes = Uint8Array.from(Buffer.from(encryptedData, 'base64'));

      // Parse encrypted object to get the Seal ID
      const encryptedObject = EncryptedObject.parse(encryptedBytes);
      const sealId = encryptedObject.id;

      // Import session key (will throw ExpiredSessionKeyError if expired)
      let importedSessionKey;
      try {
        importedSessionKey = await SessionKey.import(sessionKey, this.suiClient as any);
      } catch (importError: any) {
        // Check if it's an expired session key error
        if (importError.message?.includes('expired') || importError.constructor?.name === 'ExpiredSessionKeyError') {
          throw new Error('SESSION_KEY_EXPIRED'); // Special error code for handling
        }
        throw importError;
      }

      // Verify session key matches consumer address
      if (importedSessionKey.getAddress() !== consumerAddress) {
        throw new Error('Session key does not match consumer address');
      }

      // Build seal_approve transaction
      // sealId from EncryptedObject is a hex string, convert to bytes
      // Move contract signature: seal_approve(id: vector<u8>, feed: &DataFeed, subscription: &Subscription)
      const tx = new Transaction();
      const sealIdHex = typeof sealId === 'string' ? sealId.replace('0x', '') : sealId;
      const sealIdBytes = fromHEX(sealIdHex);
      
      tx.moveCall({
        target: `${this.packageId}::seal_access::seal_approve`,
        arguments: [
          tx.pure.vector('u8', Array.from(sealIdBytes)), // Seal identity (vector<u8>) - FIRST
          tx.object(feedId), // DataFeed object - SECOND
          tx.object(subscriptionId), // Subscription object - THIRD
        ],
      });

      // Build transaction bytes (only transaction kind) for Seal decryption
      const txBytes = await tx.build({ client: this.suiClient as any, onlyTransactionKind: true });

      // Fetch decryption keys from key servers
      // This verifies the access policy on-chain
      try {
        await this.client.fetchKeys({
          ids: [sealId],
          txBytes,
          sessionKey: importedSessionKey,
          threshold: 2, // Require 2 key servers
        });
      } catch (err) {
        const errorMsg =
          err instanceof NoAccessError
            ? 'No access to decryption keys. Please ensure you have an active subscription.'
            : 'Unable to fetch decryption keys';
        throw new Error(errorMsg);
      }

      // Decrypt using Seal with session key
      const decryptedBytes = await this.client.decrypt({
        data: encryptedBytes,
        sessionKey: importedSessionKey,
        txBytes,
      });

      // Convert decrypted bytes to string and parse JSON
      const decryptedString = new TextDecoder().decode(decryptedBytes);
      return JSON.parse(decryptedString);
    } catch (error: any) {
      console.error('[SealService] Decryption error:', error);
      throw new Error(`Seal decryption failed: ${error.message}`);
    }
  }
}

export default new SealService();


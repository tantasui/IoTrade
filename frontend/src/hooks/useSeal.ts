import { useSuiClient, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { SealClient, SessionKey, EncryptedObject, NoAccessError, type ExportedSessionKey } from '@mysten/seal';
import { fromHEX } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { useCallback, useMemo, useState } from 'react';
import { get, set } from 'idb-keyval';

// Get environment variables
const getPackageId = () => process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '';

// Seal key server object IDs for Testnet
// These are the official Seal key server object IDs
const SEAL_KEY_SERVER_OBJECT_IDS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

const TTL_MIN = 60; // 60 minutes TTL for session key

export function useSeal() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Seal client
  const sealClient = useMemo(() => {
    if (!client) return null;
    
    try {
      return new SealClient({
        suiClient: client as any, // Type compatibility workaround
        serverConfigs: SEAL_KEY_SERVER_OBJECT_IDS.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false,
      });
    } catch (err) {
      console.error('Failed to initialize Seal client:', err);
      return null;
    }
  }, [client]);

  /**
   * Get or create a SessionKey for decryption
   * SessionKey allows users to sign once per session instead of for each decryption
   */
  const getOrCreateSessionKey = useCallback(async (): Promise<SessionKey> => {
    if (!account || !client) {
      throw new Error('Wallet not connected');
    }

    const packageId = getPackageId();
    if (!packageId) {
      throw new Error('NEXT_PUBLIC_SUI_PACKAGE_ID not configured');
    }

    // Check if we have a stored session key in IndexedDB
    const sessionKeyStorageKey = `seal_session_key_${account.address}_${packageId}`;
    
    try {
      const stored: ExportedSessionKey | null = await get(sessionKeyStorageKey);
      if (stored) {
        // Import session key - need to create a new SuiClient instance for import
        const { getFullnodeUrl, SuiClient } = await import('@mysten/sui/client');
        const importClient = new SuiClient({ url: getFullnodeUrl('testnet') });
        const sessionKey = await SessionKey.import(stored, importClient);
        // Verify session key is still valid and matches current address
        if (!sessionKey.isExpired() && sessionKey.getAddress() === account.address) {
          return sessionKey;
        }
        // Remove expired/invalid session key
        await set(sessionKeyStorageKey, null);
      }
    } catch (e) {
      console.warn('Failed to load stored session key:', e);
    }

    // Create new session key
    // packageId should be a hex string, not bytes
    const sessionKey = await SessionKey.create({
      address: account.address,
      packageId: packageId, // Pass hex string directly
      ttlMin: TTL_MIN,
      suiClient: client as any, // Type compatibility workaround
    });

    // Sign the session key message with wallet
    return new Promise((resolve, reject) => {
      signPersonalMessage(
        {
          message: sessionKey.getPersonalMessage(),
        },
        {
          onSuccess: async (result: { signature: string }) => {
            try {
              await sessionKey.setPersonalMessageSignature(result.signature);
              // Store session key for future use
              await set(sessionKeyStorageKey, sessionKey.export());
              resolve(sessionKey);
            } catch (err: any) {
              reject(new Error(`Failed to set session key signature: ${err.message}`));
            }
          },
          onError: (error: Error) => {
            reject(new Error(`Failed to sign session key: ${error.message}`));
          },
        },
      );
    });
  }, [account, client, signPersonalMessage]);

  /**
   * Construct Move call for seal_approve transaction
   */
  const constructMoveCall = useCallback((packageId: string, feedId: string, subscriptionId: string) => {
    return (tx: Transaction, id: string) => {
      tx.moveCall({
        target: `${packageId}::iot_marketplace::seal_access::seal_approve`,
        arguments: [
          tx.pure.vector('u8', fromHEX(id.replace('0x', ''))), // Seal identity (vector<u8>)
          tx.object(feedId), // DataFeed object
          tx.object(subscriptionId), // Subscription object
        ],
      });
    };
  }, []);

  /**
   * Decrypt Seal-encrypted data for a premium feed
   * @param encryptedData - Base64 encoded encrypted bytes
   * @param feedId - Feed ID (used as Seal identity)
   * @param subscriptionId - Subscription object ID (for access policy check)
   * @returns Decrypted data
   */
  const decryptData = useCallback(async (
    encryptedData: string,
    feedId: string,
    subscriptionId: string
  ): Promise<any> => {
    if (!sealClient || !account) {
      throw new Error('Seal client not initialized or wallet not connected');
    }

    setIsDecrypting(true);
    setError(null);

    try {
      const packageId = getPackageId();
      if (!packageId) {
        throw new Error('NEXT_PUBLIC_SUI_PACKAGE_ID not configured');
      }

      // Convert base64 to Uint8Array
      const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

      // Parse encrypted object to get the Seal ID
      const encryptedObject = EncryptedObject.parse(encryptedBytes);
      const sealId = encryptedObject.id;

      // Get or create session key
      const sessionKey = await getOrCreateSessionKey();

      // Build seal_approve transaction
      const moveCallConstructor = constructMoveCall(packageId, feedId, subscriptionId);
      const tx = new Transaction();
      moveCallConstructor(tx, sealId);

      // Build transaction bytes (only transaction kind) for Seal decryption
      const txBytes = await tx.build({ client: client as any, onlyTransactionKind: true });

      // Fetch decryption keys from key servers
      // This verifies the access policy on-chain
      try {
        await sealClient.fetchKeys({
          ids: [sealId],
          txBytes,
          sessionKey,
          threshold: 2, // Require 2 key servers
        });
      } catch (err) {
        const errorMsg =
          err instanceof NoAccessError
            ? 'No access to decryption keys. Please ensure you have an active subscription.'
            : 'Unable to fetch decryption keys, try again';
        console.error(errorMsg, err);
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Decrypt using Seal with session key
      // Note: Keys are already fetched above, so this is just local decryption
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      // Convert decrypted bytes to string and parse JSON
      const decryptedString = new TextDecoder().decode(decryptedBytes);
      const decryptedData = JSON.parse(decryptedString);

      setIsDecrypting(false);
      return decryptedData;
    } catch (err: any) {
      console.error('Seal decryption error:', err);
      setError(err.message || 'Decryption failed');
      setIsDecrypting(false);
      throw err;
    }
  }, [sealClient, account, client, getOrCreateSessionKey, constructMoveCall]);

  /**
   * Check if Seal is properly configured
   */
  const isConfigured = useMemo(() => {
    return !!sealClient && !!getPackageId();
  }, [sealClient]);

  return {
    decryptData,
    isDecrypting,
    error,
    isConfigured,
  };
}


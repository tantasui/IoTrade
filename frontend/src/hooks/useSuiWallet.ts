import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useCallback, useRef } from 'react';

// Get environment variables
const getPackageId = () => process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '';
const getRegistryId = () => process.env.NEXT_PUBLIC_SUI_REGISTRY_ID || '';
const getTreasuryId = () => process.env.NEXT_PUBLIC_SUI_TREASURY_ID || '';

export function useSuiWallet() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  // Store the last transaction response to access it even if dapp-kit throws
  const lastTransactionResponse = useRef<any>(null);

  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) => {
      console.log('[useSuiWallet] execute: Starting transaction execution');
      try {
        const response = await client.executeTransactionBlock({
          transactionBlock: bytes,
          signature,
          options: {
            showObjectChanges: true,
            showRawEffects: true,
            showEffects: true,
          },
        });
        console.log('[useSuiWallet] execute: Transaction executed successfully');
        console.log('[useSuiWallet] execute: Response type:', typeof response);
        console.log('[useSuiWallet] execute: Response keys:', Object.keys(response || {}));
        console.log('[useSuiWallet] execute: Full response:', response);
        console.log('[useSuiWallet] execute: Response JSON:', JSON.stringify(response, null, 2));
        // Store response before returning (in case dapp-kit throws)
        lastTransactionResponse.current = response;
        return response;
      } catch (error: any) {
        console.error('[useSuiWallet] execute: Error caught:', error);
        console.error('[useSuiWallet] execute: Error message:', error.message);
        console.error('[useSuiWallet] execute: Error stack:', error.stack);
        console.error('[useSuiWallet] execute: Error object:', error);
        console.error('[useSuiWallet] execute: Error JSON:', JSON.stringify(error, null, 2));
        
        // Check if error has response data we can use
        if (error.response || error.data || error.digest) {
          console.log('[useSuiWallet] execute: Error has response/data/digest:', {
            response: error.response,
            data: error.data,
            digest: error.digest,
          });
        }
        
        // If effects parsing fails, try without showEffects
        if (error.message?.includes('parse effects') || error.message?.includes('Could not parse')) {
          console.warn('[useSuiWallet] Effects parsing failed, retrying without showEffects');
          try {
            const retryResponse = await client.executeTransactionBlock({
              transactionBlock: bytes,
              signature,
              options: {
                showObjectChanges: true,
                showRawEffects: true,
                showEffects: false,
              },
            });
            console.log('[useSuiWallet] execute: Retry successful without showEffects');
            console.log('[useSuiWallet] execute: Retry response:', retryResponse);
            return retryResponse;
          } catch (retryError: any) {
            console.error('[useSuiWallet] execute: Retry also failed:', retryError);
            // If that also fails, try with minimal options
            console.warn('[useSuiWallet] Retry failed, trying with minimal options');
            try {
              const minimalResponse = await client.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                  showObjectChanges: true,
                },
              });
              console.log('[useSuiWallet] execute: Minimal options successful');
              return minimalResponse;
            } catch (minimalError: any) {
              console.error('[useSuiWallet] execute: All retries failed');
              // Re-throw the original error with more context
              throw error;
            }
          }
        }
        throw error;
      }
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = account?.address;
  const isConnected = !!account;

  // Get SUI balance
  const getBalance = useCallback(async () => {
    if (!address) return 0;

    try {
      const balance = await client.getBalance({
        owner: address,
      });
      return parseInt(balance.totalBalance) / 1_000_000_000; // Convert MIST to SUI
    } catch (err: any) {
      console.error('Error getting balance:', err);
      return 0;
    }
  }, [address, client]);

  // Subscribe to a feed
  const subscribe = useCallback(async (
    feedId: string,
    registryId: string,
    treasuryId: string,
    tier: number,
    paymentAmount: number,
    packageId: string
  ) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      // Split coin for payment (paymentAmount expected in SUI -> convert to MIST)
      const paymentAmountMist = Math.floor(paymentAmount * 1_000_000_000);
      const [paymentCoin] = tx.splitCoins(tx.gas, [paymentAmountMist]);

      console.log('[subscribe] Building transaction with:', {
        feedId,
        registryId,
        treasuryId,
        tier,
        paymentAmountMist,
        packageId,
      });

      // Call subscribe_to_feed
      // Arguments: feed (&mut DataFeed), registry (&DataFeedRegistry), treasury (&mut PlatformTreasury), payment (Coin<SUI>), tier (u8)
      // Note: feed, registry, and treasury are shared objects - tx.object() should handle them automatically
      tx.moveCall({
        target: `${packageId}::subscription::subscribe_to_feed`,
        arguments: [
          tx.object(feedId),         // Shared object (&mut DataFeed) - arg_idx 0
          tx.object(registryId),      // Shared object (&DataFeedRegistry) - arg_idx 1
          tx.object(treasuryId),      // Shared object (&mut PlatformTreasury) - arg_idx 2
          paymentCoin,                // Coin<SUI> from splitCoins - arg_idx 3
          tx.pure.u8(tier),          // u8 tier - arg_idx 4
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any, // Type assertion to handle version mismatch between @mysten/sui and @mysten/dapp-kit
      });

      console.log('[subscribe] Transaction result:', {
        digest: result.digest,
        objectChanges: result.objectChanges,
        effectsCreated: result.effects?.created,
      });

      // Wait for transaction to be finalized (like the example)
      const { effects } = await client.waitForTransaction({
        digest: result.digest,
        options: {
          showEffects: true,
        },
      });

      // For owned objects, check effects.created
      if (effects?.created && effects.created.length > 0) {
        // Get the first created object - should be the Subscription
        const firstCreated = effects.created[0];
        if (firstCreated.reference?.objectId) {
          console.log('[subscribe] Found subscription in effects.created:', firstCreated.reference.objectId);
          setIsLoading(false);
          return firstCreated.reference.objectId;
        }
      }

      // Fallback: Try objectChanges from original result
      const createdObjects = result.objectChanges?.filter((change: any) => change.type === 'created');
      if (createdObjects && createdObjects.length > 0) {
        const subscriptionObject = createdObjects.find((obj: any) =>
          obj.objectType?.includes('Subscription')
        );
        if (subscriptionObject && 'objectId' in subscriptionObject) {
          console.log('[subscribe] Found subscription in objectChanges:', subscriptionObject.objectId);
          setIsLoading(false);
          return subscriptionObject.objectId;
        }
      }

      console.error('[subscribe] Failed to extract subscription ID. Full result:', JSON.stringify(result, null, 2));
      throw new Error('Failed to extract subscription ID from transaction result');
    } catch (err: any) {
      console.error('Error subscribing:', err);
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [address, signAndExecuteTransaction]);

  // Register a data feed
  const registerFeed = useCallback(async (
    registryId: string,
    feedData: {
      name: string;
      category: string;
      description: string;
      location: string;
      pricePerQuery: number;
      monthlySubscriptionPrice: number;
      isPremium: boolean;
      walrusBlobId: string;
      updateFrequency: number;
    },
    packageId: string
  ) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${packageId}::data_marketplace::register_data_feed`,
        arguments: [
          tx.object(registryId),
          tx.pure.string(feedData.name),
          tx.pure.string(feedData.category),
          tx.pure.string(feedData.description),
          tx.pure.string(feedData.location),
          tx.pure.u64(BigInt(feedData.pricePerQuery)),
          tx.pure.u64(BigInt(feedData.monthlySubscriptionPrice)),
          tx.pure.bool(feedData.isPremium),
          tx.pure.string(feedData.walrusBlobId),
          tx.pure.u64(BigInt(feedData.updateFrequency)),
        ],
      });

      let result;
      try {
        result = await signAndExecuteTransaction({
          transaction: tx as any, // Type assertion to handle version mismatch between @mysten/sui and @mysten/dapp-kit
        });
      } catch (executeError: any) {
        // If dapp-kit threw an error but we have the stored response, use it
        if (lastTransactionResponse.current && (executeError.message?.includes('parse effects') || executeError.message?.includes('Could not parse'))) {
          console.log('[registerFeed] dapp-kit parsing error, but transaction succeeded. Using stored response.');
          result = lastTransactionResponse.current;
          lastTransactionResponse.current = null; // Clear after use
        } else {
          console.error('=== [registerFeed] TRANSACTION EXECUTION ERROR ===');
          console.error('[registerFeed] Error object:', executeError);
          console.error('[registerFeed] Error type:', typeof executeError);
          console.error('[registerFeed] Error constructor:', executeError?.constructor?.name);
          console.error('[registerFeed] Error keys:', Object.keys(executeError || {}));
          console.error('[registerFeed] Error message:', executeError?.message);
          console.error('[registerFeed] Error stack:', executeError?.stack);
          
          // Try to get all properties (including non-enumerable)
          const allProps: any = {};
          for (const key in executeError) {
            allProps[key] = executeError[key];
          }
          console.error('[registerFeed] All error properties:', allProps);
          
          // Try JSON.stringify with replacer to get all properties
          try {
            const errorJson = JSON.stringify(executeError, (key, value) => {
              if (key === 'stack') return undefined; // Skip stack for readability
              return value;
            }, 2);
            console.error('[registerFeed] Error JSON:', errorJson);
          } catch (jsonError) {
            console.error('[registerFeed] Could not stringify error:', jsonError);
          }
          
          // Check nested properties
          console.error('[registerFeed] Checking nested properties:', {
            digest: executeError?.digest,
            response: executeError?.response,
            data: executeError?.data,
            cause: executeError?.cause,
            error: executeError?.error,
            result: executeError?.result,
            transactionDigest: executeError?.transactionDigest,
          });
          
          // If the error is about parsing effects, the transaction might have succeeded
          // Try to extract digest from error or response
          if (executeError.message?.includes('parse effects') || executeError.message?.includes('Could not parse')) {
            console.log('[registerFeed] Parsing error detected, attempting to extract digest...');
            
            // Try multiple ways to extract digest
            const errorDigest = 
              executeError.digest || 
              executeError.response?.digest || 
              executeError.data?.digest ||
              executeError.cause?.digest ||
              executeError.error?.digest ||
              executeError.result?.digest ||
              executeError.transactionDigest ||
              (executeError.response?.data && (executeError.response.data.digest || executeError.response.data.result?.digest));
            
            console.log('[registerFeed] Extracted digest:', errorDigest);
            
            if (errorDigest) {
              console.log('[registerFeed] Found digest in error, attempting to fetch transaction result:', errorDigest);
              // Try to get result using waitForTransaction
              try {
                const txResult = await client.waitForTransaction({
                  digest: errorDigest,
                  options: {
                    showEffects: true,
                    showObjectChanges: true,
                  },
                });
                // Use txResult as if it were the result (avoid duplicate digest)
                const { digest: _, ...txResultWithoutDigest } = txResult;
                result = { digest: errorDigest, ...txResultWithoutDigest };
                console.log('[registerFeed] Successfully retrieved transaction result using digest');
              } catch (waitError: any) {
                console.error('[registerFeed] Failed to retrieve transaction:', waitError);
                throw new Error(`Transaction may have succeeded but we couldn't retrieve the result. Digest: ${errorDigest}. Please check on Sui Explorer.`);
              }
            } else {
              console.warn('[registerFeed] No digest found in error object');
              throw new Error(`Transaction execution failed: ${executeError.message}. The transaction may have succeeded - please check Sui Explorer or your wallet for the transaction digest.`);
            }
          } else {
            throw executeError;
          }
          console.error('=== END ERROR LOGGING ===');
        }
      }

      // Comprehensive logging of transaction result for debugging
      console.log('=== [registerFeed] FULL TRANSACTION RESULT ===');
      console.log('Full result object:', result);
      console.log('Result keys:', Object.keys(result));
      console.log('Digest:', result.digest);
      console.log('ObjectChanges:', result.objectChanges);
      console.log('ObjectChanges type:', typeof result.objectChanges);
      console.log('ObjectChanges length:', result.objectChanges?.length);
      console.log('Effects:', result.effects);
      console.log('Effects.created:', result.effects?.created);
      console.log('Effects.created type:', typeof result.effects?.created);
      console.log('Effects.created length:', result.effects?.created?.length);
      console.log('Full result JSON:', JSON.stringify(result, null, 2));
      console.log('=== END TRANSACTION RESULT ===');

      // First, try objectChanges (most reliable for shared objects)
      if (result.objectChanges && Array.isArray(result.objectChanges) && result.objectChanges.length > 0) {
        console.log('[registerFeed] Processing objectChanges from result:', result.objectChanges.length, 'items');
        console.log('[registerFeed] All objectChanges:', result.objectChanges);
        const createdObjects = result.objectChanges.filter((change: any) => change.type === 'created') as any[];
        console.log('[registerFeed] Created objects from objectChanges:', createdObjects);
        if (createdObjects && createdObjects.length > 0) {
          // Look for DataFeed in created objects
          const feedObject = createdObjects.find((obj: any) =>
            obj.objectType?.includes('DataFeed') || obj.objectType?.includes('data_marketplace::DataFeed')
          );
          console.log('[registerFeed] Feed object from objectChanges:', feedObject);
          if (feedObject && feedObject.objectId) {
            console.log('[registerFeed] Found feed in objectChanges:', feedObject.objectId);
            setIsLoading(false);
            return feedObject.objectId as string;
          }
          // If no DataFeed found, try the first created object (might be the feed)
          const firstCreated = createdObjects[0];
          console.log('[registerFeed] First created object from objectChanges:', firstCreated);
          if (firstCreated && firstCreated.objectId) {
            console.log('[registerFeed] Found feed (first created object):', firstCreated.objectId);
            setIsLoading(false);
            return firstCreated.objectId as string;
          }
        }
      } else {
        console.log('[registerFeed] No objectChanges found in result');
      }

      // Also check effects.created for shared objects
      if (result.effects?.created && Array.isArray(result.effects.created) && result.effects.created.length > 0) {
        console.log('[registerFeed] Processing effects.created:', result.effects.created.length, 'items');
        console.log('[registerFeed] effects.created items:', result.effects.created);
        // Look for shared objects (DataFeed is shared)
        const sharedObject = result.effects.created.find(
          (item: any) => item.owner && typeof item.owner === 'object' && 'Shared' in item.owner
        );
        console.log('[registerFeed] Shared object found in effects.created:', sharedObject);
        if (sharedObject?.reference?.objectId) {
          console.log('[registerFeed] Found feed in effects.created (shared):', sharedObject.reference.objectId);
          setIsLoading(false);
          return sharedObject.reference.objectId;
        }
        // Fallback to first created
        const firstCreated = result.effects.created[0];
        console.log('[registerFeed] First created in effects:', firstCreated);
        if (firstCreated?.reference?.objectId) {
          console.log('[registerFeed] Found feed in effects.created (first):', firstCreated.reference.objectId);
          setIsLoading(false);
          return firstCreated.reference.objectId;
        }
      }

      // Fallback: Try to get from waitForTransaction with objectChanges
      try {
        const txResult = await client.waitForTransaction({
          digest: result.digest,
          options: {
            showEffects: true,
            showObjectChanges: true,
          },
        });

        // Log waitForTransaction result for debugging
        console.log('=== [registerFeed] waitForTransaction RESULT ===');
        console.log('Full txResult:', txResult);
        console.log('txResult keys:', Object.keys(txResult));
        console.log('txResult.objectChanges:', txResult.objectChanges);
        console.log('txResult.effects:', txResult.effects);
        console.log('txResult JSON:', JSON.stringify(txResult, null, 2));
        console.log('=== END waitForTransaction RESULT ===');

        // Check objectChanges from waitForTransaction
        if (txResult.objectChanges && txResult.objectChanges.length > 0) {
          console.log('[registerFeed] Processing objectChanges from waitForTransaction:', txResult.objectChanges.length, 'items');
          const createdObjects = txResult.objectChanges.filter((change: any) => change.type === 'created');
          console.log('[registerFeed] Created objects:', createdObjects);
          if (createdObjects && createdObjects.length > 0) {
            const feedObject = createdObjects.find((obj: any) =>
              obj.objectType?.includes('DataFeed')
            );
            console.log('[registerFeed] Feed object found:', feedObject);
            if (feedObject && 'objectId' in feedObject) {
              console.log('[registerFeed] Found feed in waitForTransaction objectChanges:', feedObject.objectId);
              setIsLoading(false);
              return feedObject.objectId;
            }
            // Try first created object
            const firstCreated = createdObjects[0];
            console.log('[registerFeed] First created object:', firstCreated);
            if (firstCreated && 'objectId' in firstCreated) {
              console.log('[registerFeed] Found feed (first created from waitForTransaction):', firstCreated.objectId);
              setIsLoading(false);
              return firstCreated.objectId;
            }
          }
        }

        // Check effects.created for shared objects
        if (txResult.effects?.created && txResult.effects.created.length > 0) {
          console.log('[registerFeed] Processing effects.created:', txResult.effects.created.length, 'items');
          console.log('[registerFeed] effects.created items:', txResult.effects.created);
          // Look for shared objects (DataFeed is shared)
          const sharedObject = txResult.effects.created.find(
            (item: any) => item.owner && typeof item.owner === 'object' && 'Shared' in item.owner
          );
          console.log('[registerFeed] Shared object found:', sharedObject);
          if (sharedObject?.reference?.objectId) {
            console.log('[registerFeed] Found feed in effects.created (shared):', sharedObject.reference.objectId);
            setIsLoading(false);
            return sharedObject.reference.objectId;
          }
          // Fallback to first created
          const firstCreated = txResult.effects.created[0];
          console.log('[registerFeed] First created in effects:', firstCreated);
          if (firstCreated?.reference?.objectId) {
            console.log('[registerFeed] Found feed in effects.created (first):', firstCreated.reference.objectId);
            setIsLoading(false);
            return firstCreated.reference.objectId;
          }
        }
      } catch (waitError: any) {
        console.warn('[registerFeed] waitForTransaction failed:', waitError.message);
        // Continue to error handling below
      }

      console.error('[registerFeed] Failed to extract feed ID. Full result:', JSON.stringify(result, null, 2));
      throw new Error('Failed to extract feed ID from transaction result. Check console for details.');
    } catch (err: any) {
      console.error('Error registering feed:', err);
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [address, signAndExecuteTransaction]);

  // Update feed data
  const updateFeedData = useCallback(async (
    feedId: string,
    newWalrusBlobId: string,
    packageId: string
  ) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${packageId}::data_marketplace::update_feed_data`,
        arguments: [
          tx.object(feedId),
          tx.pure.string(newWalrusBlobId),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any, // Type assertion to handle version mismatch between @mysten/sui and @mysten/dapp-kit
      });

      console.log('[updateFeedData] Transaction result:', {
        digest: result.digest,
        effects: result.effects,
      });

      // Wait for transaction to be finalized
      const { effects } = await client.waitForTransaction({
        digest: result.digest,
        options: {
          showEffects: true,
        },
      });

      setIsLoading(false);
      
      // Check if transaction was successful
      if (effects?.status?.status === 'success') {
        console.log('[updateFeedData] Feed updated successfully');
        return true;
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err: any) {
      console.error('Error updating feed:', err);
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [address, signAndExecuteTransaction, client]);

  // Transfer feed "ownership" to another provider
  // Note: Feed remains shared, but provider field is updated
  const transferFeed = useCallback(async (
    feedId: string,
    newProvider: string,
    packageId: string
  ) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${packageId}::data_marketplace::transfer_feed`,
        arguments: [
          tx.object(feedId),
          tx.pure.address(newProvider),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any, // Type assertion to handle version mismatch between @mysten/sui and @mysten/dapp-kit
      });

      setIsLoading(false);
      return result.effects?.status.status === 'success';
    } catch (err: any) {
      console.error('Error transferring feed:', err);
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [address, signAndExecuteTransaction]);

  // Submit rating
  const submitRating = useCallback(async (
    feedId: string,
    stars: number,
    comment: string,
    packageId: string
  ) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${packageId}::reputation::submit_rating`,
        arguments: [
          tx.pure.id(feedId),
          tx.pure.u8(stars),
          tx.pure.string(comment),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any, // Type assertion to handle version mismatch between @mysten/sui and @mysten/dapp-kit
      });

      setIsLoading(false);
      return result;
    } catch (err: any) {
      console.error('Error submitting rating:', err);
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [address, signAndExecuteTransaction]);

  return {
    address,
    isConnected,
    isLoading,
    error,
    getBalance,
    subscribe,
    registerFeed,
    updateFeedData,
    transferFeed,
    submitRating,
    // Helper functions for environment variables
    getPackageId,
    getRegistryId,
    getTreasuryId,
  };
}

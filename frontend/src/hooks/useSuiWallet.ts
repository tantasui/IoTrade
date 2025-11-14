import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useCallback } from 'react';

// Get environment variables
const getPackageId = () => process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '';
const getRegistryId = () => process.env.NEXT_PUBLIC_SUI_REGISTRY_ID || '';
const getTreasuryId = () => process.env.NEXT_PUBLIC_SUI_TREASURY_ID || '';

export function useSuiWallet() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showObjectChanges: true,
          showEffects: true,
        },
      }),
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
          tx.pure.bool(false), // isPremium - always false (Seal feature removed)
          tx.pure.string(feedData.walrusBlobId),
          tx.pure.u64(BigInt(feedData.updateFrequency)),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: tx as any, // Type assertion to handle version mismatch between @mysten/sui and @mysten/dapp-kit
      });

      console.log('[registerFeed] Transaction result:', {
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
        // Get the first created object - should be the DataFeed
        const firstCreated = effects.created[0];
        if (firstCreated.reference?.objectId) {
          console.log('[registerFeed] Found feed in effects.created:', firstCreated.reference.objectId);
          setIsLoading(false);
          return firstCreated.reference.objectId;
        }
      }

      // Fallback: Try objectChanges from original result
      const createdObjects = result.objectChanges?.filter((change: any) => change.type === 'created');
      if (createdObjects && createdObjects.length > 0) {
        const feedObject = createdObjects.find((obj: any) =>
          obj.objectType?.includes('DataFeed')
        );
        if (feedObject && 'objectId' in feedObject) {
          console.log('[registerFeed] Found feed in objectChanges:', feedObject.objectId);
          setIsLoading(false);
          return feedObject.objectId;
        }
      }

      console.error('[registerFeed] Failed to extract feed ID. Full result:', JSON.stringify(result, null, 2));
      throw new Error('Failed to extract feed ID from transaction result');
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

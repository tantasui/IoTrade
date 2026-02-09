import { SealClient } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { config } from './config.js';

const DEFAULT_KEY_SERVER_OBJECT_IDS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

let _sealClient: SealClient | null = null;

function getSealClient(): SealClient {
  if (!_sealClient) {
    const suiClient = new SuiClient({ url: getFullnodeUrl(config.sui.network) });
    const keyServerIds = config.seal.keyServerObjectIds.length > 0
      ? config.seal.keyServerObjectIds
      : DEFAULT_KEY_SERVER_OBJECT_IDS;

    _sealClient = new SealClient({
      suiClient: suiClient as any,
      serverConfigs: keyServerIds.map((id) => ({ objectId: id, weight: 1 })),
      verifyKeyServers: false,
    });

    console.log('[SealService] Initialized', {
      packageId: config.sui.packageId ? config.sui.packageId.slice(0, 10) + '...' : 'NOT SET',
      keyServers: keyServerIds.length,
    });
  }
  return _sealClient;
}

export function isConfigured(): boolean {
  return !!config.sui.packageId;
}

export function shouldEncrypt(): boolean {
  return config.seal.encrypt;
}

export async function encryptData(
  data: any,
  feedId: string
): Promise<{ encryptedBytes: Uint8Array; backupKey: Uint8Array }> {
  const client = getSealClient();

  let dataBytes: Uint8Array;
  if (typeof data === 'string') {
    dataBytes = new TextEncoder().encode(data);
  } else {
    dataBytes = new TextEncoder().encode(JSON.stringify(data));
  }

  const result = await client.encrypt({
    threshold: 2,
    packageId: config.sui.packageId,
    id: feedId.replace('0x', ''),
    data: dataBytes,
  });

  console.log('[SealService] Data encrypted', {
    feedId: feedId.slice(0, 10) + '...',
    dataSize: dataBytes.length,
    encryptedSize: result.encryptedObject.length,
  });

  return {
    encryptedBytes: result.encryptedObject,
    backupKey: result.key,
  };
}

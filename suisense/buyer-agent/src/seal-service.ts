import { SealClient, SessionKey, EncryptedObject, NoAccessError } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromHEX } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const PACKAGE_ID = process.env.SUI_PACKAGE_ID || '0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9';
const NETWORK = (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';

const DEFAULT_KEY_SERVER_OBJECT_IDS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

let _sealClient: SealClient | null = null;
let _suiClient: SuiClient | null = null;

function getSuiClient(): SuiClient {
  if (!_suiClient) {
    _suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  }
  return _suiClient;
}

function getSealClient(): SealClient {
  if (!_sealClient) {
    const keyServerIds = process.env.SEAL_KEY_SERVER_OBJECT_IDS
      ? process.env.SEAL_KEY_SERVER_OBJECT_IDS.split(',')
      : DEFAULT_KEY_SERVER_OBJECT_IDS;

    _sealClient = new SealClient({
      suiClient: getSuiClient() as any,
      serverConfigs: keyServerIds.map((id) => ({ objectId: id, weight: 1 })),
      verifyKeyServers: false,
    });
  }
  return _sealClient;
}

function getKeypair(): Ed25519Keypair {
  const key = (process.env.BUYER_PRIVATE_KEY || '').trim();
  if (!key) throw new Error('BUYER_PRIVATE_KEY not set in .env');
  if (key.startsWith('suiprivkey1')) {
    const decoded = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }
  return Ed25519Keypair.fromSecretKey(fromHEX(key));
}

async function createSessionKey(): Promise<SessionKey> {
  const keypair = getKeypair();
  const address = keypair.getPublicKey().toSuiAddress();

  const sessionKey = await SessionKey.create({
    address,
    packageId: PACKAGE_ID,
    ttlMin: 30,
    suiClient: getSuiClient() as any,
  });

  const personalMessage = sessionKey.getPersonalMessage();
  const { signature } = await keypair.signPersonalMessage(personalMessage);
  await sessionKey.setPersonalMessageSignature(signature);

  return sessionKey;
}

export function isEncryptedData(data: Uint8Array): boolean {
  try {
    EncryptedObject.parse(data);
    return true;
  } catch {
    return false;
  }
}

export async function decryptFeedData(
  encryptedBytes: Uint8Array,
  feedId: string,
  subscriptionId: string
): Promise<any> {
  const sealClient = getSealClient();

  // Parse encrypted object to get Seal ID
  const encryptedObject = EncryptedObject.parse(encryptedBytes);
  const sealId = encryptedObject.id;

  // Create session key signed by buyer's keypair
  console.log('Creating Seal session key...');
  const sessionKey = await createSessionKey();

  // Build seal_approve transaction
  const tx = new Transaction();
  const sealIdHex = typeof sealId === 'string' ? sealId.replace('0x', '') : sealId;
  const sealIdBytes = fromHEX(sealIdHex);

  tx.moveCall({
    target: `${PACKAGE_ID}::seal_access::seal_approve`,
    arguments: [
      tx.pure.vector('u8', Array.from(sealIdBytes)),
      tx.object(feedId),
      tx.object(subscriptionId),
    ],
  });

  const txBytes = await tx.build({
    client: getSuiClient() as any,
    onlyTransactionKind: true,
  });

  // Fetch decryption keys from Seal key servers
  console.log('Fetching decryption keys from Seal key servers...');
  try {
    await sealClient.fetchKeys({
      ids: [sealId],
      txBytes,
      sessionKey,
      threshold: 2,
    });
  } catch (err) {
    if (err instanceof NoAccessError) {
      throw new Error(
        'No access to decryption keys. Ensure you have an active subscription for this feed.'
      );
    }
    throw new Error(`Failed to fetch decryption keys: ${(err as Error).message}`);
  }

  // Decrypt
  console.log('Decrypting data...');
  const decryptedBytes = await sealClient.decrypt({
    data: encryptedBytes,
    sessionKey,
    txBytes,
  });

  const decryptedString = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(decryptedString);
}

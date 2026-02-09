import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from suisense/ parent directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  sui: {
    privateKey: process.env.SUI_PRIVATE_KEY || '',
    packageId: process.env.SUI_PACKAGE_ID || '0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9',
    network: (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet',
    registryId: process.env.SUI_REGISTRY_ID || '',
    treasuryId: process.env.SUI_TREASURY_ID || '',
  },
  walrus: {
    publisherUrl: process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space',
    aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space',
    epochs: parseInt(process.env.WALRUS_EPOCHS || '5'),
  },
  sensor: {
    port: parseInt(process.env.SENSOR_PORT || '3001'),
  },
  seal: {
    encrypt: process.env.SEAL_ENCRYPT === 'true',
    keyServerObjectIds: process.env.SEAL_KEY_SERVER_OBJECT_IDS
      ? process.env.SEAL_KEY_SERVER_OBJECT_IDS.split(',')
      : [],
  },
  dataFeedId: process.env.DATA_FEED_ID || '',
};

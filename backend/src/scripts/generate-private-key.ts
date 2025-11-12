import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
// Note: getSecretKey() returns a Bech32-encoded suiprivkey string
import fs from 'fs';
import path from 'path';

function writeEnv(privateKey: string) {
  const envPath = path.resolve(__dirname, '../../.env');
  const envLine = `SUI_PRIVATE_KEY=${privateKey}\n`;
  try {
    if (fs.existsSync(envPath)) {
      const existing = fs.readFileSync(envPath, 'utf8');
      const filtered = existing
        .split('\n')
        .filter((line) => !line.startsWith('SUI_PRIVATE_KEY='))
        .join('\n');
      fs.writeFileSync(envPath, filtered + (filtered.endsWith('\n') ? '' : '\n') + envLine);
    } else {
      fs.writeFileSync(envPath, envLine);
    }
    console.log(`Wrote SUI_PRIVATE_KEY to ${envPath}`);
  } catch (e) {
    console.error('Failed to write .env:', e);
  }
}

function main() {
  // Generate a new Ed25519 keypair
  const keypair = new Ed25519Keypair();
  const address = keypair.getPublicKey().toSuiAddress();

  // Obtain the Bech32-encoded "suiprivkey" directly
  const bech32 = keypair.getSecretKey();

  // Output JSON for easy consumption
  const output = { privateKey: bech32, address };
  console.log(JSON.stringify(output, null, 2));

  // Optionally write to backend/.env if flag passed
  if (process.argv.includes('--write-env')) {
    writeEnv(bech32);
  }
}

main();
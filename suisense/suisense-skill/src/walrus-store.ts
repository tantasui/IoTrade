import axios from 'axios';
import { config } from './config.js';

export async function uploadData(data: object): Promise<string> {
  const jsonStr = JSON.stringify(data);
  const uploadUrl = `${config.walrus.publisherUrl}/v1/blobs?epochs=${config.walrus.epochs}`;

  console.log('[WalrusStore] Uploading', { url: uploadUrl, size: jsonStr.length });

  const response = await axios.put(uploadUrl, jsonStr, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });

  // Support multiple response shapes across Walrus versions
  let blobId: string | undefined;
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
    console.warn('[WalrusStore] Unexpected response shape', parseErr);
  }

  if (!blobId) {
    console.error('[WalrusStore] Failed to parse response', response.data);
    throw new Error('Failed to get blob ID from Walrus response');
  }

  console.log(`[WalrusStore] Uploaded blob: ${blobId}`);
  return blobId;
}

export async function retrieveData(blobId: string): Promise<any> {
  const url = `${config.walrus.aggregatorUrl}/v1/blobs/${blobId}`;
  console.log('[WalrusStore] Retrieving', { url });

  const response = await axios.get(url, { responseType: 'text' });

  try {
    return JSON.parse(response.data);
  } catch {
    return response.data;
  }
}

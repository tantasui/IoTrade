/**
 * API Key Service
 * Handles generation, hashing, validation, and management of API keys
 */

import * as crypto from 'crypto';
import prisma from './prisma.service';
import { ApiKeyType } from '@prisma/client';

export interface CreateApiKeyParams {
  type: ApiKeyType;
  feedId?: string;
  subscriptionId?: string;
  providerAddress?: string;
  consumerAddress?: string;
  name?: string;
  description?: string;
  expiresAt?: Date;
  rateLimit?: number;
}

export interface ApiKeyResult {
  id: string;
  key: string; // Full key (pk_xxx... or sk_xxx...) - only shown once!
  keyPrefix: string;
  type: ApiKeyType;
  createdAt: Date;
  expiresAt?: Date;
}

class ApiKeyService {
  /**
   * Generate a new API key
   * Format: pk_xxx... or sk_xxx... (32 random chars after prefix)
   */
  private generateKey(prefix: string): string {
    const randomBytes = crypto.randomBytes(24).toString('base64url'); // 32 chars
    return `${prefix}_${randomBytes}`;
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Extract prefix from key (pk_ or sk_)
   */
  private getKeyPrefix(key: string): string {
    return key.substring(0, 3); // pk_ or sk_
  }

  /**
   * Create a new API key
   */
  async createApiKey(params: CreateApiKeyParams): Promise<ApiKeyResult> {
    const prefix = params.type === ApiKeyType.PROVIDER ? 'pk' : 'sk';
    const fullKey = this.generateKey(prefix);
    const keyHash = this.hashKey(fullKey);
    const keyPrefix = this.getKeyPrefix(fullKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        type: params.type,
        feedId: params.feedId,
        subscriptionId: params.subscriptionId,
        providerAddress: params.providerAddress,
        consumerAddress: params.consumerAddress,
        name: params.name,
        description: params.description,
        expiresAt: params.expiresAt,
        rateLimit: params.rateLimit,
      },
    });

    return {
      id: apiKey.id,
      key: fullKey, // Return full key (only time it's shown!)
      keyPrefix: apiKey.keyPrefix,
      type: apiKey.type,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt || undefined,
    };
  }

  /**
   * Validate an API key
   */
  async validateApiKey(key: string): Promise<{
    valid: boolean;
    apiKey?: any;
    error?: string;
  }> {
    const keyHash = this.hashKey(key);
    const keyPrefix = this.getKeyPrefix(key);

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        usageLogs: {
          take: 1,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check if revoked
    if (apiKey.revokedAt) {
      return { valid: false, error: 'API key has been revoked' };
    }

    // Check if expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Check prefix matches
    if (apiKey.keyPrefix !== keyPrefix) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    return { valid: true, apiKey };
  }

  /**
   * Get all API keys for a provider
   */
  async getProviderKeys(providerAddress: string) {
    return prisma.apiKey.findMany({
      where: {
        providerAddress,
        type: ApiKeyType.PROVIDER,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all API keys for a subscriber
   */
  async getSubscriberKeys(consumerAddress: string) {
    return prisma.apiKey.findMany({
      where: {
        consumerAddress,
        type: ApiKeyType.SUBSCRIBER,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Alias for getSubscriberKeys (for consistency with route naming)
   */
  async getApiKeysBySubscriber(consumerAddress: string) {
    return this.getSubscriberKeys(consumerAddress);
  }

  /**
   * Alias for getProviderKeys (for consistency with route naming)
   */
  async getApiKeysByProvider(providerAddress: string) {
    return this.getProviderKeys(providerAddress);
  }

  /**
   * Alias for getFeedKeys (for consistency with route naming)
   */
  async getApiKeysByFeed(feedId: string) {
    return this.getFeedKeys(feedId);
  }

  /**
   * Get API keys for a specific feed
   */
  async getFeedKeys(feedId: string) {
    return prisma.apiKey.findMany({
      where: {
        feedId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Get API key details (without the actual key)
   */
  async getApiKeyDetails(keyId: string) {
    return prisma.apiKey.findUnique({
      where: { id: keyId },
      include: {
        usageLogs: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }
}

export default new ApiKeyService();


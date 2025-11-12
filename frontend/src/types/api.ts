export interface DataFeed {
  id: string;
  provider: string;
  name: string;
  category: string;
  description: string;
  location: string;
  pricePerQuery: number; // in MIST
  monthlySubscriptionPrice: number; // in MIST
  isPremium: boolean;
  walrusBlobId: string;
  createdAt: number;
  lastUpdated: number;
  isActive: boolean;
  updateFrequency: number; // seconds
  totalSubscribers: number;
  totalRevenue: number; // in MIST
}

export interface Subscription {
  id: string;
  consumer: string;
  feedId: string;
  tier: number; // 0 = pay-per-query, 1 = monthly, 2 = premium
  startEpoch: number;
  expiryEpoch: number;
  paymentAmount: number; // in MIST
  queriesUsed: number;
  isActive: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  [key: string]: any;
}

export interface ApiError {
  success: false;
  error: string;
}

export type FeedsListResponse = ApiSuccess<DataFeed[]> & { count: number } | ApiError;
export type FeedResponse = ApiSuccess<DataFeed> | ApiError;
export type CreateFeedResponse = ApiSuccess<{ feedId: string; walrusBlobId: string }> | ApiError;
export type UpdateFeedDataResponse = ApiSuccess<{ feedId: string; newWalrusBlobId: string }> | ApiError;
export type SubscribeResponse = ApiSuccess<{ subscriptionId: string; feedId: string; tier: number; paymentAmount: number }> | ApiError;
export type SubscriptionResponse = ApiSuccess<Subscription> | ApiError;
export type VerifyAccessResponse = ApiSuccess<{ hasAccess: boolean; subscriptionId: string }> | ApiError;
export type DataResponse = ApiSuccess<any> & { feed?: { id: string; name: string; category: string; lastUpdated: number } } | ApiError;
export type DataHistoryResponse = ApiSuccess<Array<{ timestamp: number; data: any }>> & { count: number } | ApiError;
export interface ApiKey {
  id: string;
  keyPrefix: string; // pk_ or sk_
  type: 'PROVIDER' | 'SUBSCRIBER';
  feedId?: string;
  subscriptionId?: string;
  providerAddress?: string;
  consumerAddress?: string;
  name?: string;
  description?: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  rateLimit?: number;
}

export interface CreateApiKeyResponse {
  success: true;
  data: {
    id: string;
    key: string; // Full key - only shown once!
    keyPrefix: string;
    type: 'PROVIDER' | 'SUBSCRIBER';
    createdAt: string;
    expiresAt?: string;
  };
}

export type ApiKeysListResponse = ApiSuccess<ApiKey[]> | ApiError;
export type ApiKeyResponse = ApiSuccess<ApiKey> | ApiError;
export type CreateApiKeyResponseType = CreateApiKeyResponse | ApiError;
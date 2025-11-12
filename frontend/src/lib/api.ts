import axios, { AxiosInstance } from 'axios';
import {
  FeedsListResponse,
  FeedResponse,
  CreateFeedResponse,
  UpdateFeedDataResponse,
  SubscribeResponse,
  SubscriptionResponse,
  VerifyAccessResponse,
  DataResponse,
  DataHistoryResponse,
  UploadDataResponse,
  HealthResponse,
  ApiKeysListResponse,
  ApiKeyResponse,
  CreateApiKeyResponseType,
} from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // =================== Feeds ===================

  async getAllFeeds(params?: {
    category?: string;
    isPremium?: boolean;
    minPrice?: number;
    maxPrice?: number;
    location?: string;
  }): Promise<FeedsListResponse> {
    const response = await this.client.get('/api/feeds', { params });
    return response.data as FeedsListResponse;
  }

  async getFeed(id: string): Promise<FeedResponse> {
    const response = await this.client.get(`/api/feeds/${id}`);
    return response.data as FeedResponse;
  }

  async createFeed(feedData: {
    provider?: string;
    name: string;
    category: string;
    description: string;
    location: string;
    pricePerQuery?: number;
    monthlySubscriptionPrice?: number;
    isPremium?: boolean;
    updateFrequency?: number;
    initialData: any;
  }): Promise<CreateFeedResponse> {
    const response = await this.client.post('/api/feeds', feedData);
    return response.data as CreateFeedResponse;
  }

  async updateFeedData(feedId: string, data: any, provider?: string): Promise<UpdateFeedDataResponse> {
    const response = await this.client.put(`/api/feeds/${feedId}/data`, {
      data,
      provider,
    });
    return response.data as UpdateFeedDataResponse;
  }

  async submitRating(feedId: string, stars: number, comment: string): Promise<any> {
    const response = await this.client.post(`/api/feeds/${feedId}/rating`, {
      stars,
      comment,
    });
    return response.data;
  }

  // =================== Subscriptions ===================

  async subscribe(feedId: string, params: {
    consumer?: string;
    tier: number;
    paymentAmount: number;
  }): Promise<SubscribeResponse> {
    const response = await this.client.post(`/api/subscribe/${feedId}`, params);
    return response.data as SubscribeResponse;
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
    const response = await this.client.get(`/api/subscriptions/${subscriptionId}`);
    return response.data as SubscriptionResponse;
  }

  async verifyAccess(subscriptionId: string, consumer: string): Promise<VerifyAccessResponse> {
    const response = await this.client.post(`/api/subscriptions/${subscriptionId}/verify`, {
      consumer,
    });
    return response.data as VerifyAccessResponse;
  }

  // =================== Data ===================

  async getData(feedId: string, params: {
    subscriptionId?: string;
    consumer?: string;
    preview?: boolean;
  }): Promise<DataResponse> {
    const response = await this.client.get(`/api/data/${feedId}`, { params });
    return response.data as DataResponse;
  }

  async getDataHistory(feedId: string, subscriptionId: string, consumer: string, limit?: number): Promise<DataHistoryResponse> {
    const response = await this.client.get(`/api/data/${feedId}/history`, {
      params: { subscriptionId, consumer, limit },
    });
    return response.data as DataHistoryResponse;
  }

  async uploadData(data: any, encrypt?: boolean): Promise<UploadDataResponse> {
    const response = await this.client.post('/api/data/upload', {
      data,
      encrypt,
    });
    return response.data as UploadDataResponse;
  }

  // =================== API Keys ===================

  async createProviderApiKey(params: {
    feedId: string;
    providerAddress: string;
    name?: string;
    description?: string;
    expiresAt?: string;
    rateLimit?: number;
  }): Promise<CreateApiKeyResponseType> {
    const response = await this.client.post('/api/api-keys/provider', params);
    return response.data as CreateApiKeyResponseType;
  }

  async createSubscriberApiKey(params: {
    subscriptionId: string;
    consumerAddress: string;
    name?: string;
    description?: string;
    expiresAt?: string;
  }): Promise<CreateApiKeyResponseType> {
    const response = await this.client.post('/api/api-keys/subscriber', params);
    return response.data as CreateApiKeyResponseType;
  }

  async getProviderApiKeys(providerAddress: string): Promise<ApiKeysListResponse> {
    const response = await this.client.get(`/api/api-keys/provider/${providerAddress}`);
    return response.data as ApiKeysListResponse;
  }

  async getSubscriberApiKeys(consumerAddress: string): Promise<ApiKeysListResponse> {
    const response = await this.client.get(`/api/api-keys/subscriber/${consumerAddress}`);
    return response.data as ApiKeysListResponse;
  }

  async getFeedApiKeys(feedId: string): Promise<ApiKeysListResponse> {
    const response = await this.client.get(`/api/api-keys/feed/${feedId}`);
    return response.data as ApiKeysListResponse;
  }

  async getApiKeyDetails(keyId: string): Promise<ApiKeyResponse> {
    const response = await this.client.get(`/api/api-keys/${keyId}`);
    return response.data as ApiKeyResponse;
  }

  async revokeApiKey(keyId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await this.client.delete(`/api/api-keys/${keyId}`);
    return response.data;
  }

  // =================== Subscriber Dashboard ===================

  async getSubscriberSubscriptions(address: string): Promise<any> {
    const response = await this.client.get(`/api/subscriber/${address}/subscriptions`);
    return response.data;
  }

  async getSubscriberUsage(address: string, params?: {
    startDate?: string;
    endDate?: string;
    feedId?: string;
  }): Promise<any> {
    const response = await this.client.get(`/api/subscriber/${address}/usage`, { params });
    return response.data;
  }

  async getSubscriberFeeds(address: string): Promise<any> {
    const response = await this.client.get(`/api/subscriber/${address}/feeds`);
    return response.data;
  }

  // =================== Health ===================

  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get('/health');
    return response.data as HealthResponse;
  }
}

export const apiClient = new ApiClient();
export default apiClient;

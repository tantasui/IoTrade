export interface DataFeedMetadata {
  name: string;
  category: string;
  description: string;
  location: string;
  pricePerQuery: number;
  monthlySubscriptionPrice: number;
  isPremium: boolean;
  updateFrequency: number; // in seconds
}

export interface DataFeed {
  id: string;
  provider: string;
  name: string;
  category: string;
  description: string;
  location: string;
  pricePerQuery: number;
  monthlySubscriptionPrice: number;
  isPremium: boolean;
  walrusBlobId: string;
  createdAt: number;
  lastUpdated: number;
  isActive: boolean;
  updateFrequency: number;
  totalSubscribers: number;
  totalRevenue: number;
}

export interface Subscription {
  id: string;
  consumer: string;
  feedId: string;
  tier: number; // 0 = pay-per-query, 1 = monthly, 2 = premium
  startEpoch: number;
  expiryEpoch: number;
  paymentAmount: number;
  queriesUsed: number;
  isActive: boolean;
}

export interface DataQualityMetrics {
  feedId: string;
  uptimePercentage: number;
  totalUpdates: number;
  missedUpdates: number;
  averageResponseTimeMs: number;
  lastUpdateTimestamp: number;
}

export interface Rating {
  id: string;
  feedId: string;
  consumer: string;
  stars: number; // 1-5
  comment: string;
  timestamp: number;
  helpfulnessVotes: number;
}

export interface ProviderReputation {
  provider: string;
  totalRatings: number;
  averageRating: number;
  totalRevenue: number;
  totalSubscribers: number;
  responseRate: number;
  verified: boolean;
}

export interface WalrusUploadResponse {
  blobId: string;
  eventOrObject: any;
}

export interface SealEncryptionResult {
  encryptedData: string;
  accessKeys: { [address: string]: string };
}

export interface IoTDataPoint {
  timestamp: number;
  deviceId: string;
  data: any;
  metadata?: any;
}

export enum SubscriptionTier {
  PAY_PER_QUERY = 0,
  MONTHLY = 1,
  PREMIUM = 2
}

export enum DataCategory {
  WEATHER = 'weather',
  TRAFFIC = 'traffic',
  AIR_QUALITY = 'air_quality',
  PARKING = 'parking',
  ENERGY = 'energy',
  SMART_HOME = 'smart_home',
  INDUSTRIAL = 'industrial',
  OTHER = 'other'
}

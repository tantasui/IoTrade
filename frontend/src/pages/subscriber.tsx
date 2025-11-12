import { useState, useEffect } from 'react';
import Layout from '@/components/common/Layout';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import apiClient from '@/lib/api';
import SubscriberApiKeyManager from '@/components/subscriber/SubscriberApiKeyManager';
import Modal from '@/components/common/Modal';
import type { Subscription, DataFeed } from '@/types/api';

interface SubscriptionWithFeed extends Subscription {
  feed?: DataFeed;
  apiKeyId?: string;
  apiKeyPrefix?: string;
}

export default function SubscriberDashboard() {
  const { isConnected, address } = useSuiWallet();
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithFeed[]>([]);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithFeed | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'usage'>('subscriptions');
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (isConnected && address) {
      loadSubscriptions();
      loadUsageStats();
    }
  }, [isConnected, address]);

  const loadSubscriptions = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getSubscriberSubscriptions(address!);
      if (response && response.success) {
        // Load feed details for each subscription
        const subscriptionsWithFeeds = await Promise.all(
          (response.data || []).map(async (sub: SubscriptionWithFeed) => {
            try {
              const feedResponse = await apiClient.getFeed(sub.feedId);
              if (feedResponse && 'success' in feedResponse && feedResponse.success) {
                return { ...sub, feed: feedResponse.data };
              }
            } catch (error) {
              console.error('Error loading feed:', error);
            }
            return sub;
          })
        );
        setSubscriptions(subscriptionsWithFeeds);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsageStats = async () => {
    try {
      const response = await apiClient.getSubscriberUsage(address!);
      if (response && response.success) {
        setUsageStats(response.data);
      }
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  const formatEpoch = (epoch: number) => {
    // Convert Sui epoch to approximate date (rough estimate)
    const currentEpoch = 1000; // Example current epoch
    const epochDiff = epoch - currentEpoch;
    const daysDiff = epochDiff * 0.5; // Rough estimate: 0.5 days per epoch
    const date = new Date();
    date.setDate(date.getDate() + daysDiff);
    return date.toLocaleDateString();
  };

  const getTierName = (tier: number) => {
    switch (tier) {
      case 0:
        return 'Pay-per-Query';
      case 1:
        return 'Monthly';
      case 2:
        return 'Premium';
      default:
        return `Tier ${tier}`;
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold mb-4 text-[#2d2d2d]">Subscriber Dashboard</h1>
          <p className="text-[#333333] mb-8">
            Please connect your wallet to view your subscriptions and usage.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-[#2d2d2d]">Subscriber Dashboard</h1>
          <p className="text-[#333333]">Manage your subscriptions, API keys, and view usage statistics</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-[#e0e0e0]">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'subscriptions'
                ? 'text-[#56c214] border-b-2 border-[#56c214]'
                : 'text-[#333333] hover:text-[#2d2d2d]'
            }`}
          >
            My Subscriptions ({subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'usage'
                ? 'text-[#56c214] border-b-2 border-[#56c214]'
                : 'text-[#333333] hover:text-[#2d2d2d]'
            }`}
          >
            Usage Statistics
          </button>
        </div>

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div>
            {isLoading ? (
              <div className="card text-center py-12">
                <p className="text-[#333333]">Loading subscriptions...</p>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-[#333333] mb-4">You don't have any subscriptions yet.</p>
                <a href="/consumer" className="btn-primary">
                  Browse Marketplace
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="card">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1 text-[#2d2d2d]">
                          {subscription.feed?.name || 'Unknown Feed'}
                        </h3>
                        <span className="badge-premium">{getTierName(subscription.tier)}</span>
                      </div>
                      {subscription.isActive ? (
                        <span className="badge-active">Active</span>
                      ) : (
                        <span className="badge-premium bg-[#e90d1] text-white">Expired</span>
                      )}
                    </div>

                    {subscription.feed && (
                      <p className="text-sm text-[#333333] mb-4">{subscription.feed.description}</p>
                    )}

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-[#333333]">Feed ID:</span>
                        <code className="text-xs font-mono text-[#2d2d2d] bg-[#f5f5f5] px-1 rounded-[4px] border border-[#e0e0e0]">
                          {subscription.feedId.substring(0, 8)}...
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#333333]">Queries Used:</span>
                        <span className="font-medium text-[#2d2d2d]">{subscription.queriesUsed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#333333]">Expires:</span>
                        <span className="font-medium text-[#2d2d2d]">
                          Epoch {subscription.expiryEpoch}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#333333]">Paid:</span>
                        <span className="font-medium text-[#56c214]">
                          {(subscription.paymentAmount / 1_000_000_000).toFixed(4)} SUI
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedSubscription(subscription)}
                        className="btn-primary flex-1 text-sm"
                      >
                        Manage
                      </button>
                      <a
                        href={`/consumer?feedId=${subscription.feedId}`}
                        className="btn-secondary flex-1 text-sm text-center"
                      >
                        View Feed
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Usage Statistics Tab */}
        {activeTab === 'usage' && (
          <div>
            {usageStats ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card">
                    <h3 className="text-sm font-medium text-[#333333] mb-2">Total Requests</h3>
                    <p className="text-3xl font-bold text-[#2d2d2d]">{usageStats.totalRequests || 0}</p>
                  </div>
                  <div className="card">
                    <h3 className="text-sm font-medium text-[#333333] mb-2">Total Queries</h3>
                    <p className="text-3xl font-bold text-[#2d2d2d]">{usageStats.totalQueries || 0}</p>
                  </div>
                  <div className="card">
                    <h3 className="text-sm font-medium text-[#333333] mb-2">Data Transferred</h3>
                    <p className="text-3xl font-bold text-[#2d2d2d]">
                      {usageStats.totalDataSize
                        ? `${(usageStats.totalDataSize / 1024 / 1024).toFixed(2)} MB`
                        : '0 MB'}
                    </p>
                  </div>
                </div>

                {/* Usage by Feed */}
                {usageStats.byFeed && usageStats.byFeed.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-bold mb-4 text-[#2d2d2d]">Usage by Feed</h3>
                    <div className="space-y-3">
                      {usageStats.byFeed.map((feedUsage: any) => (
                        <div key={feedUsage.feedId} className="flex justify-between items-center p-3 bg-[#f5f5f5] rounded-[4px] border border-[#e0e0e0]">
                          <div>
                            <code className="text-xs font-mono text-[#2d2d2d]">
                              {feedUsage.feedId.substring(0, 16)}...
                            </code>
                          </div>
                          <div className="text-sm text-[#333333]">
                            {feedUsage.requests} requests • {feedUsage.queries} queries
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Usage by Date */}
                {usageStats.byDate && usageStats.byDate.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-bold mb-4 text-[#2d2d2d]">Usage Over Time</h3>
                    <div className="space-y-2">
                      {usageStats.byDate.slice(0, 10).map((dayUsage: any) => (
                        <div key={dayUsage.date} className="flex justify-between items-center">
                          <span className="text-sm text-[#333333]">{dayUsage.date}</span>
                          <span className="text-sm font-medium text-[#2d2d2d]">
                            {dayUsage.requests} requests
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-[#333333]">No usage data available yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscription Details Modal */}
      {selectedSubscription && (
        <div className="modal-backdrop" onClick={() => setSelectedSubscription(null)}>
          <div className="modal max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-[#2d2d2d]">
                    {selectedSubscription.feed?.name || 'Subscription Details'}
                  </h2>
                  <p className="text-[#333333]">{selectedSubscription.feed?.description}</p>
                </div>
                <button
                  onClick={() => setSelectedSubscription(null)}
                  className="text-gray-400 hover:text-[#2d2d2d] transition-colors p-1 hover:bg-[#f5f5f5] rounded-[4px]"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-bold mb-4 text-[#2d2d2d]">Subscription Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Subscription ID:</span>
                      <code className="font-mono text-xs text-[#2d2d2d] bg-[#f5f5f5] px-2 py-1 rounded-[4px] break-all border border-[#e0e0e0]">
                        {selectedSubscription.id.substring(0, 16)}...
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Tier:</span>
                      <span className="font-medium text-[#2d2d2d]">{getTierName(selectedSubscription.tier)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Status:</span>
                      <span className={`font-medium ${selectedSubscription.isActive ? 'text-[#56c214]' : 'text-[#e90d1]'}`}>
                        {selectedSubscription.isActive ? 'Active' : 'Expired'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Queries Used:</span>
                      <span className="font-medium text-[#2d2d2d]">{selectedSubscription.queriesUsed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Expires:</span>
                      <span className="font-medium text-[#2d2d2d]">Epoch {selectedSubscription.expiryEpoch}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold mb-4 text-[#2d2d2d]">Data Access Endpoint</h3>
                  <div className="bg-[#f5f5f5] p-3 rounded-[4px] mb-3 border border-[#e0e0e0]">
                    <p className="text-xs text-[#333333] mb-1">Use this endpoint to access data:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono break-all text-[#2d2d2d] bg-white px-2 py-1 rounded-[4px] flex-1 border border-[#e0e0e0]">
                        {process.env.NEXT_PUBLIC_API_URL || 'https://io-trade.vercel.app'}/api/data/{selectedSubscription.feedId}
                      </code>
                      <button
                        onClick={(e) => {
                          const endpoint = `${process.env.NEXT_PUBLIC_API_URL || 'https://io-trade.vercel.app'}/api/data/${selectedSubscription.feedId}`;
                          navigator.clipboard.writeText(endpoint);
                          // Show brief feedback
                          const btn = e.currentTarget;
                          const originalText = btn.innerHTML;
                          btn.innerHTML = '✓ Copied';
                          btn.classList.add('bg-[#56c214]', 'text-white');
                          setTimeout(() => {
                            btn.innerHTML = originalText;
                            btn.classList.remove('bg-[#56c214]', 'text-white');
                          }, 2000);
                        }}
                        className="px-3 py-1 bg-[#2d2d2d] text-white rounded-[4px] hover:bg-[#1a1a1a] transition-colors text-xs font-medium whitespace-nowrap"
                        title="Copy endpoint"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#333333] mb-3">
                    Include your API key in the <code className="bg-[#f5f5f5] px-1 rounded-[4px] text-[#2d2d2d] border border-[#e0e0e0]">X-API-Key</code> header
                  </p>
                </div>
              </div>

              {/* API Key Management */}
              <div className="mb-6">
                <SubscriberApiKeyManager
                  subscriptionId={selectedSubscription.id}
                  consumerAddress={address!}
                  feedId={selectedSubscription.feedId}
                  onKeyCreated={() => {
                    loadSubscriptions();
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <a
                  href={`/consumer?feedId=${selectedSubscription.feedId}`}
                  className="btn-primary flex-1 text-center"
                >
                  View Feed Data
                </a>
                <button
                  onClick={() => setSelectedSubscription(null)}
                  className="btn-secondary flex-1"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </Layout>
  );
}


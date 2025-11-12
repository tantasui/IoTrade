import { useState, useEffect } from 'react';
import Layout from '@/components/common/Layout';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useSeal } from '@/hooks/useSeal';
import apiClient from '@/lib/api';
import Modal from '@/components/common/Modal';
import type { DataFeed } from '@/types/api';

export default function ConsumerMarketplace() {
  const { isConnected, address, subscribe, getPackageId, getRegistryId, getTreasuryId } = useSuiWallet();
  const { decryptData, isDecrypting, isConfigured: isSealConfigured } = useSeal();
  const [feeds, setFeeds] = useState<DataFeed[]>([]);
  const [filteredFeeds, setFilteredFeeds] = useState<DataFeed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<DataFeed | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Filters
  const [filters, setFilters] = useState({
    category: 'all',
    isPremium: 'all',
    location: '',
  });

  useEffect(() => {
    loadFeeds();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [feeds, filters]);

  const loadFeeds = async () => {
    try {
      const response = await apiClient.getAllFeeds();
      if (response && 'success' in response && response.success) {
        setFeeds(response.data || []);
      } else {
        setFeeds([]);
      }
    } catch (error) {
      console.error('Error loading feeds:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...feeds];

    if (filters.category !== 'all') {
      filtered = filtered.filter((feed) => feed.category === filters.category);
    }

    if (filters.isPremium === 'premium') {
      filtered = filtered.filter((feed) => feed.isPremium);
    } else if (filters.isPremium === 'free') {
      filtered = filtered.filter((feed) => !feed.isPremium);
    }

    if (filters.location) {
      filtered = filtered.filter((feed) =>
        feed.location.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    setFilteredFeeds(filtered);
  };

  const handlePreview = async (feed: DataFeed) => {
    setSelectedFeed(feed);
    setIsLoading(true);

    try {
      // Check if user has a subscription for this feed
      const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '{}');
      const subscriptionId = subscriptions[feed.id];

      let response;
      if (subscriptionId && isConnected && address) {
        // Use subscription to get full data access
        response = await apiClient.getData(feed.id, {
          subscriptionId,
          consumer: address,
        });
      } else {
        // Use preview mode
        response = await apiClient.getData(feed.id, { preview: true });
      }

      if (response && 'success' in response && response.success) {
        // Check if data is Seal-encrypted
        if (response.encrypted && response.encryptionType === 'seal') {
          // Decrypt Seal-encrypted data
          if (!subscriptionId || !isConnected || !address) {
            setModal({
              isOpen: true,
              title: 'Decryption Required',
              message: 'This is a premium feed. Please subscribe to decrypt the data.',
              type: 'error',
            });
            setPreviewData(null);
            return;
          }

          if (!isSealConfigured) {
            setModal({
              isOpen: true,
              title: 'Seal Not Configured',
              message: 'Seal encryption is not properly configured. Please check environment variables.',
              type: 'error',
            });
            setPreviewData(null);
            return;
          }

          try {
            // Decrypt the encrypted data
            const decryptedData = await decryptData(
              response.data, // Base64 encoded encrypted bytes
              feed.id, // Feed ID
              subscriptionId // Subscription object ID
            );
            setPreviewData(decryptedData);
          } catch (decryptError: any) {
            console.error('Decryption error:', decryptError);
            setModal({
              isOpen: true,
              title: 'Decryption Failed',
              message: decryptError.message || 'Failed to decrypt premium feed data. Please ensure your subscription is active.',
              type: 'error',
            });
            setPreviewData(null);
          }
        } else {
          // Regular (non-encrypted) data
          setPreviewData(response.data);
        }
      } else {
        setPreviewData(null);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (feed: DataFeed, tier: number) => {
    if (!isConnected || !address) {
      setModal({
        isOpen: true,
        title: 'Wallet Not Connected',
        message: 'Please connect your wallet first to subscribe to feeds.',
        type: 'error',
      });
      return;
    }

    const price = tier === 1 ? feed.monthlySubscriptionPrice : feed.pricePerQuery;
    const priceInSui = price / 1_000_000_000;

    const confirm = window.confirm(
      `Subscribe to ${feed.name} for ${priceInSui.toFixed(4)} SUI?`
    );

    if (!confirm) return;

    try {
      setIsLoading(true);
      
      const packageId = getPackageId();
      const registryId = getRegistryId();
      const treasuryId = getTreasuryId();
      
      if (!packageId || !registryId || !treasuryId) {
        throw new Error('Missing environment variables. Please check NEXT_PUBLIC_SUI_* variables.');
      }

      // Subscribe using wallet signing
      const subscriptionId = await subscribe(
        feed.id,
        registryId,
        treasuryId,
        tier,
        priceInSui, // Amount in SUI (will be converted to MIST in hook)
        packageId
      );

      setModal({
        isOpen: true,
        title: 'Subscription Successful',
        message: `Successfully subscribed to ${feed.name}! Subscription ID: ${subscriptionId}`,
        type: 'success',
      });
      
      // Store subscription ID in localStorage
      const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '{}');
      subscriptions[feed.id] = subscriptionId;
      localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
      
      // Refresh preview if this feed is currently selected
      if (selectedFeed && selectedFeed.id === feed.id) {
        await handlePreview(feed);
      }
    } catch (error: any) {
      console.error('Error subscribing:', error);
      setModal({
        isOpen: true,
        title: 'Subscription Failed',
        message: error.message || 'Failed to subscribe. Please try again.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-[#2d2d2d]">IoTrade Marketplace</h1>
        <p className="text-[#333333]">Browse and subscribe to real-time IoT data feeds</p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <h2 className="text-lg font-bold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Category</label>
            <select
              className="input"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="all">All Categories</option>
              <option value="weather">Weather</option>
              <option value="traffic">Traffic</option>
              <option value="air_quality">Air Quality</option>
              <option value="parking">Parking</option>
              <option value="energy">Energy</option>
              <option value="smart_home">Smart Home</option>
              <option value="industrial">Industrial</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Type</label>
            <select
              className="input"
              value={filters.isPremium}
              onChange={(e) => setFilters({ ...filters, isPremium: e.target.value })}
            >
              <option value="all">All Types</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Location</label>
            <input
              type="text"
              className="input"
              placeholder="Search location..."
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Feed Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#2d2d2d]">Available Feeds</h2>
          <span className="text-[#333333]">{filteredFeeds.length} feeds found</span>
        </div>

        {filteredFeeds.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-[#333333]">No data feeds match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFeeds.map((feed) => (
              <div key={feed.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-[#2d2d2d]">{feed.name}</h3>
                  {feed.isPremium ? (
                    <span className="badge-premium">Premium</span>
                  ) : (
                    <span className="badge-free">Free</span>
                  )}
                </div>

                <p className="text-sm text-[#333333] mb-4 line-clamp-3">{feed.description}</p>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-[#333333]">Category:</span>
                    <span className="font-medium capitalize text-[#2d2d2d]">{feed.category.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#333333]">Location:</span>
                    <span className="font-medium text-[#2d2d2d]">{feed.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#333333]">Update Freq:</span>
                    <span className="font-medium text-[#2d2d2d]">Every {feed.updateFrequency}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#333333]">Monthly Price:</span>
                    <span className="font-medium text-[#56c214]">
                      {(feed.monthlySubscriptionPrice / 1_000_000_000).toFixed(4)} SUI
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#333333]">Subscribers:</span>
                    <span className="font-medium text-[#2d2d2d]">{feed.totalSubscribers}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handlePreview(feed)}
                    className="btn-secondary w-full text-sm"
                  >
                    Preview Data
                  </button>
                  <button
                    onClick={() => handleSubscribe(feed, 1)}
                    className="btn-primary w-full text-sm"
                    disabled={!isConnected}
                  >
                    {isConnected ? 'Subscribe' : 'Connect Wallet'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedFeed && (
        <div className="modal-backdrop" onClick={() => {
          setSelectedFeed(null);
          setPreviewData(null);
        }}>
          <div className="modal max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-8">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-[#2d2d2d]">{selectedFeed.name}</h2>
                  <p className="text-[#333333]">{selectedFeed.description}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFeed(null);
                    setPreviewData(null);
                  }}
                  className="text-gray-400 hover:text-[#2d2d2d] transition-colors p-1 hover:bg-[#f5f5f5] rounded-[4px]"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <h3 className="font-bold mb-2 text-[#2d2d2d]">Feed Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#333333]">Category:</span>
                    <span className="ml-2 font-medium capitalize text-[#2d2d2d]">{selectedFeed.category.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-[#333333]">Location:</span>
                    <span className="ml-2 font-medium text-[#2d2d2d]">{selectedFeed.location}</span>
                  </div>
                  <div>
                    <span className="text-[#333333]">Monthly Price:</span>
                    <span className="ml-2 font-medium text-[#2d2d2d]">
                      {(selectedFeed.monthlySubscriptionPrice / 1_000_000_000).toFixed(4)} SUI
                    </span>
                  </div>
                  <div>
                    <span className="text-[#333333]">Update Frequency:</span>
                    <span className="ml-2 font-medium text-[#2d2d2d]">Every {selectedFeed.updateFrequency}s</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold mb-2 text-[#2d2d2d]">Data Preview</h3>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#56c214] mx-auto"></div>
                    <p className="text-[#333333] mt-4">Loading preview...</p>
                  </div>
                ) : previewData ? (
                  <pre className="bg-[#f5f5f5] p-4 rounded-[4px] text-sm overflow-x-auto border border-[#e0e0e0]">
                    {JSON.stringify(previewData, null, 2)}
                  </pre>
                ) : (
                  <p className="text-[#333333]">No preview available</p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleSubscribe(selectedFeed, 1)}
                  className="btn-primary flex-1"
                  disabled={!isConnected}
                >
                  Subscribe Now
                </button>
                <button
                  onClick={() => {
                    setSelectedFeed(null);
                    setPreviewData(null);
                  }}
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

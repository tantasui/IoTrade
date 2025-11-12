import { useState, useEffect } from 'react';
import Layout from '@/components/common/Layout';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import apiClient from '@/lib/api';
import ApiKeyManager from '@/components/provider/ApiKeyManager';
import Modal from '@/components/common/Modal';
import type { DataFeed } from '@/types/api';

export default function ProviderDashboard() {
  const { isConnected, address, registerFeed, updateFeedData, getPackageId, getRegistryId } = useSuiWallet();
  const [feeds, setFeeds] = useState<DataFeed[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<DataFeed | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'weather',
    description: '',
    location: '',
    pricePerQuery: 0,
    monthlySubscriptionPrice: 0.1,
    isPremium: false,
    updateFrequency: 300,
    initialData: '',
  });

  useEffect(() => {
    if (isConnected && address) {
      loadMyFeeds();
    }
  }, [isConnected, address]);

  const loadMyFeeds = async () => {
    try {
      const response = await apiClient.getAllFeeds();
      if (response && 'success' in response && response.success) {
        const allFeeds = response.data || [];
        const myFeeds = allFeeds.filter((feed: DataFeed) => feed.provider === address);
        setFeeds(myFeeds);
      } else {
        setFeeds([]);
      }
    } catch (error) {
      console.error('Error loading feeds:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('[Provider] handleSubmit start', { formData });
      
      // Step 1: Upload initial data to Walrus (backend API)
      let parsedData;
      try {
        parsedData = JSON.parse(formData.initialData);
      } catch {
        parsedData = formData.initialData;
      }

      console.log('[Provider] Uploading data to Walrus...');
      const uploadResponse = await apiClient.uploadData(parsedData, formData.isPremium);
      
      if (!uploadResponse || !uploadResponse.success || !uploadResponse.data?.blobId) {
        throw new Error('Failed to upload data to Walrus');
      }

      const walrusBlobId = uploadResponse.data.blobId;
      console.log('[Provider] Data uploaded to Walrus:', walrusBlobId);

      // Step 2: Register feed on-chain (wallet signing)
      const packageId = getPackageId();
      const registryId = getRegistryId();
      
      if (!packageId || !registryId) {
        throw new Error('Missing environment variables: NEXT_PUBLIC_SUI_PACKAGE_ID or NEXT_PUBLIC_SUI_REGISTRY_ID');
      }

      console.log('[Provider] Registering feed on-chain...');
      const feedId = await registerFeed(registryId, {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        location: formData.location,
        pricePerQuery: Math.floor(formData.pricePerQuery * 1_000_000_000), // Convert to MIST
        monthlySubscriptionPrice: Math.floor(formData.monthlySubscriptionPrice * 1_000_000_000),
        isPremium: formData.isPremium,
        walrusBlobId: walrusBlobId,
        updateFrequency: formData.updateFrequency,
      }, packageId);

      console.log('[Provider] Feed registered:', feedId);

      // Feed is already shared, so consumers can subscribe directly
      // No need to call share_feed_for_subscriptions

      setModal({
        isOpen: true,
        title: 'Feed Created',
        message: `Feed "${formData.name}" has been created successfully! Feed ID: ${feedId}`,
        type: 'success',
      });
      setShowCreateForm(false);
      loadMyFeeds();
      
      // Reset form
      setFormData({
        name: '',
        category: 'weather',
        description: '',
        location: '',
        pricePerQuery: 0,
        monthlySubscriptionPrice: 0.1,
        isPremium: false,
        updateFrequency: 300,
        initialData: '',
      });
    } catch (error: any) {
      console.error('Error creating feed:', error?.message || error);
      setModal({
        isOpen: true,
        title: 'Error Creating Feed',
        message: error.message || 'Failed to create feed. Please try again.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      console.log('[Provider] handleSubmit end');
    }
  };

  const handleUpdateData = async (feedId: string) => {
    const newData = prompt('Enter new data (JSON format):');
    if (!newData) return;

    try {
      setIsLoading(true);
      
      // Step 1: Upload new data to Walrus
      let parsedData;
      try {
        parsedData = JSON.parse(newData);
      } catch {
        parsedData = newData;
      }

      const uploadResponse = await apiClient.uploadData(parsedData);
      if (!uploadResponse || !uploadResponse.success || !uploadResponse.data?.blobId) {
        throw new Error('Failed to upload data to Walrus');
      }

      const walrusBlobId = uploadResponse.data.blobId;

      // Step 2: Update feed on-chain (wallet signing)
      const packageId = getPackageId();
      if (!packageId) {
        throw new Error('Missing environment variable: NEXT_PUBLIC_SUI_PACKAGE_ID');
      }

      await updateFeedData(feedId, walrusBlobId, packageId);

      setModal({
        isOpen: true,
        title: 'Data Updated',
        message: 'Feed data has been updated successfully!',
        type: 'success',
      });
      loadMyFeeds();
    } catch (error: any) {
      console.error('Error updating data:', error);
      setModal({
        isOpen: true,
        title: 'Error Updating Data',
        message: error.message || 'Failed to update data. Please try again.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold mb-4 text-[#2d2d2d]">Provider Dashboard</h1>
          <p className="text-[#333333] mb-8">
            Please connect your wallet to access the provider dashboard.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-[#2d2d2d]">Provider Dashboard</h1>
            <p className="text-[#333333]">Manage your data feeds and track earnings</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary"
          >
            {showCreateForm ? 'Cancel' : '+ Create New Feed'}
          </button>
        </div>

        {/* Create Feed Form */}
        {showCreateForm && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-4 text-[#2d2d2d]">Create New Data Feed</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Feed Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter feed name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Category</label>
                  <select
                    className="input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
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
                  <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Location</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., San Francisco, CA"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Update Frequency (seconds)</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.updateFrequency}
                    onChange={(e) => setFormData({ ...formData, updateFrequency: parseInt(e.target.value) })}
                    min="1"
                    placeholder="300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Price per Query (SUI)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="input"
                    value={formData.pricePerQuery}
                    onChange={(e) => setFormData({ ...formData, pricePerQuery: parseFloat(e.target.value) })}
                    min="0"
                    placeholder="0.001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Monthly Subscription (SUI)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={formData.monthlySubscriptionPrice}
                    onChange={(e) => setFormData({ ...formData, monthlySubscriptionPrice: parseFloat(e.target.value) })}
                    min="0"
                    placeholder="0.1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your data feed..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[#2d2d2d]">Initial Data (JSON)</label>
                <textarea
                  className="input font-mono text-sm"
                  rows={6}
                  value={formData.initialData}
                  onChange={(e) => setFormData({ ...formData, initialData: e.target.value })}
                  placeholder='{"temperature": 72, "humidity": 45}'
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPremium"
                  checked={formData.isPremium}
                  onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="isPremium" className="text-sm font-medium">
                  Premium Feed (Seal encrypted)
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Feed'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My Feeds */}
        <div>
          <h2 className="text-2xl font-bold mb-4">My Data Feeds</h2>
          {feeds.length === 0 ? (
            <div className="card text-center py-12">
                  <p className="text-[#333333] mb-4">You haven't created any data feeds yet.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary"
              >
                Create Your First Feed
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {feeds.map((feed) => (
                <div key={feed.id} className="card">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-[#2d2d2d]">{feed.name}</h3>
                    {feed.isPremium ? (
                      <span className="badge-premium">Premium</span>
                    ) : (
                      <span className="badge-free">Free</span>
                    )}
                  </div>

                  <p className="text-sm text-[#333333] mb-4">{feed.description}</p>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Category:</span>
                      <span className="font-medium text-[#2d2d2d]">{feed.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Location:</span>
                      <span className="font-medium text-[#2d2d2d]">{feed.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Subscribers:</span>
                      <span className="font-medium text-[#2d2d2d]">{feed.totalSubscribers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Revenue:</span>
                      <span className="font-medium text-[#56c214]">{(feed.totalRevenue / 1_000_000_000).toFixed(4)} SUI</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateData(feed.id)}
                      className="btn-primary flex-1 text-sm"
                    >
                      Update Data
                    </button>
                    <button
                      onClick={() => setSelectedFeed(feed)}
                      className="btn-secondary flex-1 text-sm"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feed Details Modal */}
      {selectedFeed && (
        <div className="modal-backdrop" onClick={() => setSelectedFeed(null)}>
          <div className="modal max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-[#2d2d2d]">{selectedFeed.name}</h2>
                  <p className="text-[#333333]">{selectedFeed.description}</p>
                </div>
                <button
                  onClick={() => setSelectedFeed(null)}
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
                  <h3 className="font-bold mb-4 text-[#2d2d2d]">Feed Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Feed ID:</span>
                      <code className="font-mono text-xs text-[#2d2d2d] bg-[#f5f5f5] px-2 py-1 rounded-[4px] break-all border border-[#e0e0e0]">{selectedFeed.id}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Category:</span>
                      <span className="font-medium text-[#2d2d2d] capitalize">{selectedFeed.category.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Location:</span>
                      <span className="font-medium text-[#2d2d2d]">{selectedFeed.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Update Frequency:</span>
                      <span className="font-medium text-[#2d2d2d]">Every {selectedFeed.updateFrequency}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Subscribers:</span>
                      <span className="font-medium text-[#2d2d2d]">{selectedFeed.totalSubscribers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#333333]">Total Revenue:</span>
                      <span className="font-medium text-[#56c214]">
                        {(selectedFeed.totalRevenue / 1_000_000_000).toFixed(4)} SUI
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold mb-4 text-[#2d2d2d]">IoT Device Endpoint</h3>
                  <div className="bg-[#f5f5f5] p-3 rounded-[4px] mb-3 border border-[#e0e0e0]">
                    <p className="text-xs text-[#333333] mb-1">Use this endpoint in your IoT device:</p>
                    <code className="text-xs font-mono break-all text-[#2d2d2d] bg-white px-2 py-1 rounded-[4px] block border border-[#e0e0e0]">
                      {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/iot/feeds/{selectedFeed.id}/update
                    </code>
                  </div>
                  <p className="text-xs text-[#333333] mb-3">
                    Include your API key in the <code className="bg-[#f5f5f5] px-1 rounded-[4px] text-[#2d2d2d] border border-[#e0e0e0]">X-API-Key</code> header
                  </p>
                </div>
              </div>

              {/* API Key Management */}
              <div className="mb-6">
                <ApiKeyManager
                  feedId={selectedFeed.id}
                  providerAddress={address!}
                  onKeyCreated={() => {
                    // Refresh feed data if needed
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => handleUpdateData(selectedFeed.id)}
                  className="btn-primary flex-1"
                >
                  Update Data
                </button>
                <button
                  onClick={() => setSelectedFeed(null)}
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

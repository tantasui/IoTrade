import { useState, useEffect } from 'react';
import Layout from '@/components/common/Layout';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { useWebSocket } from '@/hooks/useWebSocket';
import apiClient from '@/lib/api';
import FeedStream from '@/components/FeedStream';
import type { DataFeed } from '@/types/api';

export default function TestWebSocket() {
  const { isConnected, address } = useSuiWallet();
  const [feeds, setFeeds] = useState<DataFeed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<DataFeed | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [subscriberApiKey, setSubscriberApiKey] = useState<string>(''); // For WebSocket decryption
  const [providerApiKey, setProviderApiKey] = useState<string>(''); // For sending test data
  const [testData, setTestData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    loadFeeds();
    loadSubscriptions();
  }, [address]);

  const loadFeeds = async () => {
    try {
      const response = await apiClient.getAllFeeds();
      if (response && 'success' in response && response.success) {
        setFeeds(response.data || []);
      }
    } catch (error) {
      console.error('Error loading feeds:', error);
    }
  };

  const loadSubscriptions = async () => {
    if (!address) return;
    try {
      const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '{}');
      if (selectedFeed && subscriptions[selectedFeed.id]) {
        setSubscriptionId(subscriptions[selectedFeed.id]);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  };

  useEffect(() => {
    if (selectedFeed) {
      loadSubscriptions();
    }
  }, [selectedFeed, address]);

  const handleSendTestData = async () => {
    if (!selectedFeed) {
      alert('Please select a feed first');
      return;
    }

    setIsLoading(true);
    try {
      // Use the provider API key from input field
      if (!providerApiKey) {
        alert('Please provide a provider API key (pk_xxx) to send test data');
        setIsLoading(false);
        return;
      }

      // Send test data update
      const testPayload = {
        temperature: Math.floor(Math.random() * 30) + 20,
        humidity: Math.floor(Math.random() * 40) + 40,
        timestamp: Date.now(),
        test: true,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/iot/feeds/${selectedFeed.id}/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': providerApiKey,
          },
          body: JSON.stringify({
            deviceId: 'test-device-123',
            data: testPayload,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setTestData(testPayload);
        setMessages((prev) => [
          { type: 'sent', data: testPayload, timestamp: Date.now() },
          ...prev,
        ]);
        alert('Test data sent successfully! Check WebSocket messages below.');
      } else {
        alert('Failed to send test data: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error sending test data:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[#e5e7eb]">WebSocket Streaming Test</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Configuration */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold mb-4 text-[#e5e7eb]">Configuration</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-[#e5e7eb]">
                  Select Feed
                </label>
                <select
                  className="input"
                  value={selectedFeed?.id || ''}
                  onChange={(e) => {
                    const feed = feeds.find((f) => f.id === e.target.value);
                    setSelectedFeed(feed || null);
                  }}
                >
                  <option value="">-- Select a feed --</option>
                  {feeds.map((feed) => (
                    <option key={feed.id} value={feed.id}>
                      {feed.name} {feed.isPremium ? '(Premium)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFeed && (
                <>
                  <div className="mb-4 p-3 bg-[#111827] rounded-[4px] border border-[#2d3748]">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#9ca3af]">Feed ID:</span>
                        <code className="text-xs text-[#e5e7eb] font-mono">
                          {selectedFeed.id.substring(0, 16)}...
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9ca3af]">Premium:</span>
                        <span className={selectedFeed.isPremium ? 'text-[#56c214]' : 'text-[#9ca3af]'}>
                          {selectedFeed.isPremium ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9ca3af]">Subscription:</span>
                        <span className={subscriptionId ? 'text-[#56c214]' : 'text-[#9ca3af]'}>
                          {subscriptionId ? 'Active' : 'Not Subscribed'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedFeed.isPremium && !subscriptionId && (
                    <div className="mb-4 p-3 bg-[#7f1d1d] border border-[#b91c1c] rounded-[4px]">
                      <p className="text-sm text-[#fca5a5]">
                        ⚠️ This is a premium feed. You need to subscribe to decrypt WebSocket messages.
                        <br />
                        <a href="/consumer" className="underline">
                          Subscribe here
                        </a>
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-[#e5e7eb]">
                      Subscriber API Key (for WebSocket - Option 1)
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="sk_... (for premium feeds)"
                      value={subscriberApiKey}
                      onChange={(e) => setSubscriberApiKey(e.target.value)}
                    />
                    <p className="text-xs text-[#9ca3af] mt-1">
                      {selectedFeed?.isPremium 
                        ? '✅ Required for premium feeds. Get from Subscriber Dashboard → API Keys. Session key will be auto-stored when you connect!'
                        : 'Optional. Get from Subscriber Dashboard → API Keys'}
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-[#e5e7eb]">
                      Provider API Key (for sending test data)
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="pk_..."
                      value={providerApiKey}
                      onChange={(e) => setProviderApiKey(e.target.value)}
                    />
                    <p className="text-xs text-[#9ca3af] mt-1">
                      Get this from Provider Dashboard → Manage Feed → API Keys
                    </p>
                  </div>

                  <button
                    onClick={handleSendTestData}
                    disabled={isLoading || !selectedFeed}
                    className="btn-primary w-full"
                  >
                    {isLoading ? 'Sending...' : 'Send Test Data Update'}
                  </button>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="card bg-[#1a2f0a] border-[#56c214]">
              <h3 className="text-lg font-bold mb-2 text-[#56c214]">How to Test</h3>
              <ol className="text-sm text-[#9ca3af] space-y-2 list-decimal list-inside">
                <li>Select a feed (premium or regular)</li>
                <li>If premium, make sure you're subscribed</li>
                <li>Enter subscriber API key (sk_xxx) - session key will be auto-stored!</li>
                <li>Click "Connect" - backend automatically stores session key</li>
                <li>Watch the WebSocket stream receive decrypted data</li>
                <li>Now use subscriber-viewer with just API key (no wallet!)</li>
              </ol>
              <div className="mt-4 p-3 bg-[#1a2f0a] border border-[#56c214] rounded">
                <p className="text-xs text-[#56c214] font-bold mb-1">✨ Option 1 Active!</p>
                <p className="text-xs text-[#9ca3af]">
                  When you connect with wallet + API key, the session key is automatically stored server-side.
                  Then subscriber-viewer can use just the API key - no wallet needed!
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: WebSocket Stream */}
          <div>
            {selectedFeed ? (
              <FeedStream
                feedId={selectedFeed.id}
                subscriptionId={subscriptionId || undefined}
                apiKey={subscriberApiKey || undefined}
                enabled={!!selectedFeed}
                onData={(data) => {
                  setMessages((prev) => [
                    { type: 'received', data, timestamp: Date.now(), decrypted: selectedFeed.isPremium },
                    ...prev,
                  ]);
                }}
                onError={(error) => {
                  setMessages((prev) => [
                    { type: 'error', error, timestamp: Date.now() },
                    ...prev,
                  ]);
                }}
              />
            ) : (
              <div className="card">
                <p className="text-[#9ca3af] text-center py-8">
                  Select a feed to start streaming
                </p>
              </div>
            )}

            {/* Message Log */}
            {messages.length > 0 && (
              <div className="card mt-6">
                <h3 className="text-lg font-bold mb-4 text-[#e5e7eb]">Message Log</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-[4px] border text-xs ${
                        msg.type === 'error'
                          ? 'bg-[#7f1d1d] border-[#b91c1c] text-[#fca5a5]'
                          : msg.type === 'sent'
                          ? 'bg-[#1a2f0a] border-[#56c214] text-[#9ca3af]'
                          : 'bg-[#111827] border-[#2d3748] text-[#e5e7eb]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">
                          {msg.type === 'sent' && '📤 Sent'}
                          {msg.type === 'received' && (msg.decrypted ? '🔓 Received (Decrypted)' : '📥 Received')}
                          {msg.type === 'error' && '❌ Error'}
                        </span>
                        <span className="text-[#6b7280]">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {msg.data && (
                        <pre className="mt-2 overflow-x-auto">
                          {JSON.stringify(msg.data, null, 2)}
                        </pre>
                      )}
                      {msg.error && <p>{msg.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}



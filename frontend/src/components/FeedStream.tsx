/**
 * FeedStream Component
 * 
 * Example component showing how to use WebSocket for real-time data streaming
 * with automatic decryption for premium feeds.
 * 
 * Usage:
 * ```tsx
 * <FeedStream
 *   feedId="0x..."
 *   subscriptionId="0x..." // Required for premium feeds
 *   apiKey="sk_..." // Optional: API key for authentication
 *   onData={(data) => console.log('New data:', data)}
 *   onError={(error) => console.error('Error:', error)}
 * />
 * ```
 */

import { useWebSocket } from '@/hooks/useWebSocket';
import { useState, useEffect } from 'react';

interface FeedStreamProps {
  feedId: string;
  subscriptionId?: string;
  apiKey?: string;
  onData?: (data: any) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
  showStatus?: boolean;
}

export default function FeedStream({
  feedId,
  subscriptionId,
  apiKey,
  onData,
  onError,
  enabled = true,
  showStatus = true,
}: FeedStreamProps) {
  const [latestData, setLatestData] = useState<any>(null);
  const [dataHistory, setDataHistory] = useState<any[]>([]);

  const { isConnected, isDecrypting } = useWebSocket({
    feedId,
    subscriptionId,
    apiKey,
    onData: (data) => {
      setLatestData(data);
      setDataHistory((prev) => [data, ...prev].slice(0, 10)); // Keep last 10 updates
      onData?.(data);
    },
    onError: (error) => {
      console.error('[FeedStream] Error:', error);
      onError?.(error);
    },
    enabled,
  });

  if (!showStatus) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#e5e7eb]">Real-time Stream</h3>
        <div className="flex items-center gap-2">
          {isDecrypting && (
            <span className="text-sm text-[#9ca3af]">Decrypting...</span>
          )}
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-[#56c214]' : 'bg-[#6b7280]'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>
      </div>

      {latestData && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-[#9ca3af] mb-2">Latest Update</h4>
          <pre className="bg-[#111827] p-3 rounded-[4px] text-xs overflow-x-auto border border-[#2d3748] text-[#e5e7eb]">
            {JSON.stringify(latestData, null, 2)}
          </pre>
        </div>
      )}

      {dataHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#9ca3af] mb-2">
            Recent Updates ({dataHistory.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dataHistory.map((data, index) => (
              <div
                key={index}
                className="text-xs text-[#9ca3af] bg-[#111827] p-2 rounded-[4px] border border-[#2d3748]"
              >
                <div className="font-mono truncate">
                  {JSON.stringify(data).substring(0, 100)}
                  {JSON.stringify(data).length > 100 && '...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!latestData && isConnected && (
        <p className="text-sm text-[#9ca3af] text-center py-4">
          Waiting for data updates...
        </p>
      )}

      {!isConnected && (
        <p className="text-sm text-[#9ca3af] text-center py-4">
          Connecting to stream...
        </p>
      )}
    </div>
  );
}




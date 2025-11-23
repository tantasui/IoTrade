import { useEffect, useRef, useState, useCallback } from 'react';
import { useSeal } from './useSeal';
import { useSuiWallet } from './useSuiWallet';
import { SessionKey } from '@mysten/seal';
import apiClient from '@/lib/api';

interface WebSocketMessage {
  type: 'data' | 'subscribed' | 'unsubscribed' | 'error';
  feedId?: string;
  data?: any;
  encrypted?: boolean;
  encryptionType?: 'seal' | 'aes';
  timestamp?: number;
  error?: string;
}

interface UseWebSocketOptions {
  feedId: string;
  subscriptionId?: string;
  apiKey?: string;
  onData?: (data: any) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

export function useWebSocket({
  feedId,
  subscriptionId,
  apiKey,
  onData,
  onError,
  enabled = true,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionKeyRef = useRef<any>(null); // Store session key for automatic backend decryption
  const { decryptData, getOrCreateSessionKey } = useSeal();
  const { address, isConnected: walletConnected } = useSuiWallet();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';

  const connect = useCallback(() => {
    if (!enabled || !feedId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        
        // Get or create session key for automatic backend decryption (if wallet connected)
        let exportedSessionKey = null;
        if (walletConnected && address && subscriptionId) {
          try {
            const sessionKey = await getOrCreateSessionKey();
            exportedSessionKey = await sessionKey.export();
            sessionKeyRef.current = exportedSessionKey;
            console.log('[WebSocket] Session key created for automatic decryption');
          } catch (error: any) {
            console.warn('[WebSocket] Failed to create session key, backend will send encrypted data:', error.message);
          }
        }
        
        // Subscribe to feed with session key for automatic backend decryption
        ws.send(JSON.stringify({
          type: 'subscribe',
          feedId,
          subscriptionId,
          consumer: address,
          apiKey,
          sessionKey: exportedSessionKey, // Backend will decrypt automatically if provided
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'subscribed') {
            console.log('[WebSocket] Subscribed to feed:', feedId);
          } else if (message.type === 'data') {
            // Check if data is encrypted (backend didn't decrypt automatically)
            if (message.encrypted && message.encryptionType === 'seal') {
              // Backend didn't decrypt (no session key or decryption failed)
              // Fall back to client-side decryption
              if (!subscriptionId || !walletConnected) {
                onError?.('Subscription required to decrypt premium feed data. Provide session key for automatic decryption.');
                return;
              }

              try {
                setIsDecrypting(true);
                // Decrypt the encrypted data on client side
                const decryptedData = await decryptData(
                  message.data, // Base64 encoded encrypted bytes
                  feedId,
                  subscriptionId
                );
                onData?.(decryptedData);
              } catch (decryptError: any) {
                console.error('[WebSocket] Decryption error:', decryptError);
                onError?.(decryptError.message || 'Failed to decrypt premium feed data');
              } finally {
                setIsDecrypting(false);
              }
            } else {
              // Plaintext data (either non-premium or backend decrypted automatically)
              onData?.(message.data);
            }
          } else if (message.type === 'error') {
            onError?.(message.error || 'WebSocket error');
          } else if (message.type === 'unsubscribed') {
            console.log('[WebSocket] Unsubscribed from feed');
          }
        } catch (error: any) {
          console.error('[WebSocket] Message parse error:', error);
          onError?.(error.message || 'Failed to parse WebSocket message');
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setIsConnected(false);
        onError?.('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (error: any) {
      console.error('[WebSocket] Connection error:', error);
      onError?.(error.message || 'Failed to connect to WebSocket');
    }
  }, [feedId, subscriptionId, apiKey, address, walletConnected, enabled, wsUrl, decryptData, onData, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      // Unsubscribe before closing
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
        }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled && feedId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, feedId, connect, disconnect]);

  return {
    isConnected,
    isDecrypting,
    connect,
    disconnect,
  };
}



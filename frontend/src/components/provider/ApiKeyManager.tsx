import { useState, useEffect } from 'react';
import apiClient from '@/lib/api';
import type { ApiKey } from '@/types/api';

interface ApiKeyManagerProps {
  feedId: string;
  providerAddress: string;
  onKeyCreated?: () => void;
}

export default function ApiKeyManager({ feedId, providerAddress, onKeyCreated }: ApiKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expiresAt: '',
    rateLimit: '',
  });

  const loadApiKeys = async () => {
    try {
      const response = await apiClient.getFeedApiKeys(feedId);
      if (response && 'success' in response && response.success) {
        setApiKeys(response.data || []);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiClient.createProviderApiKey({
        feedId,
        providerAddress,
        name: formData.name || undefined,
        description: formData.description || undefined,
        expiresAt: formData.expiresAt || undefined,
        rateLimit: formData.rateLimit ? parseInt(formData.rateLimit) : undefined,
      });

      if (response && 'success' in response && response.success && 'data' in response) {
        setNewKey(response.data.key);
        setShowCreateForm(false);
        setFormData({ name: '', description: '', expiresAt: '', rateLimit: '' });
        loadApiKeys();
        onKeyCreated?.();
      }
    } catch (error: any) {
      console.error('Error creating API key:', error);
      // Show error inline or use a toast notification
      const errorMsg = error.message || 'Failed to create API key';
      // For now, we'll show it in console and let parent handle if needed
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const response = await apiClient.revokeApiKey(keyId);
      if (response.success) {
        loadApiKeys();
      }
    } catch (error: any) {
      console.error('Error revoking API key:', error);
      // Error handling - could show toast notification
    }
  };

  // Load keys on mount
  useEffect(() => {
    loadApiKeys();
  }, [feedId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">API Keys</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-secondary text-sm"
        >
          {showCreateForm ? 'Cancel' : '+ New API Key'}
        </button>
      </div>

      {/* New Key Display (shown once) */}
      {newKey && (
        <div className="card bg-[#f5f5f5] border-[#56c214] border-2">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-[#56c214]">✅ API Key Created!</h4>
            <button
              onClick={() => setNewKey(null)}
              className="text-[#333333] hover:text-[#2d2d2d]"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-[#333333] mb-2">
            ⚠️ Copy this key now - you won't be able to see it again!
          </p>
          <div className="bg-white p-3 rounded-[4px] border border-[#e0e0e0]">
            <code className="text-sm font-mono break-all text-[#2d2d2d]">{newKey}</code>
          </div>
          <button
            onClick={(e) => {
              navigator.clipboard.writeText(newKey);
              const btn = e.currentTarget;
              const originalText = btn.innerHTML;
              btn.innerHTML = '✓ Copied!';
              btn.classList.add('bg-[#56c214]', 'text-white');
              setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('bg-[#56c214]', 'text-white');
              }, 2000);
            }}
            className="btn-primary mt-2 text-sm"
          >
            Copy to Clipboard
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="card">
          <h4 className="font-bold mb-4 text-[#2d2d2d]">Create New API Key</h4>
          <form onSubmit={handleCreateKey} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#2d2d2d]">Name (optional)</label>
              <input
                type="text"
                className="input text-sm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., My IoT Device"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#2d2d2d]">Description (optional)</label>
              <textarea
                className="input text-sm"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this key for?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-[#2d2d2d]">Expires At (optional)</label>
                <input
                  type="date"
                  className="input text-sm"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[#2d2d2d]">Rate Limit (req/min)</label>
                <input
                  type="number"
                  className="input text-sm"
                  value={formData.rateLimit}
                  onChange={(e) => setFormData({ ...formData, rateLimit: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Key'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <p className="text-sm text-[#333333]">No API keys created yet.</p>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((key) => (
            <div key={key.id} className="card">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono bg-[#f5f5f5] px-2 py-1 rounded-[4px] text-[#2d2d2d] border border-[#e0e0e0]">
                      {key.keyPrefix}...
                    </code>
                    {key.name && <span className="font-medium text-[#2d2d2d]">{key.name}</span>}
                    {key.revokedAt && (
                      <span className="badge-premium bg-[#e90d1] text-white">Revoked</span>
                    )}
                    {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                      <span className="badge-premium bg-[#e90d1] text-white">Expired</span>
                    )}
                  </div>
                  {key.description && (
                    <p className="text-xs text-[#333333] mb-1">{key.description}</p>
                  )}
                  <div className="text-xs text-[#333333] space-y-1">
                    <div>Created: {new Date(key.createdAt).toLocaleDateString()}</div>
                    {key.lastUsedAt && (
                      <div>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</div>
                    )}
                    <div>Usage: {key.usageCount} requests</div>
                    {key.rateLimit && <div>Rate limit: {key.rateLimit} req/min</div>}
                  </div>
                </div>
                {!key.revokedAt && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="btn-danger text-xs"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


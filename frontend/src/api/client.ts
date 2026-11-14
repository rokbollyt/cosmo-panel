import type {
  HostSettings,
  SubscriptionHeaders,
  TrafficPoint,
  VpnKey,
} from '../types/vpn';

export interface SystemStats {
  uptimeSeconds: number;
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  activeKeysCount: number;
  totalKeysCount: number;
}

export interface OverviewResponse {
  stats: SystemStats;
  trafficSeries: TrafficPoint[];
}

const API_BASE = ''; // relative to host

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';

  // Check URL query param ?auth=...
  const urlParams = new URLSearchParams(window.location.search);
  const qToken = urlParams.get('auth');
  if (qToken) {
    try {
      localStorage.setItem('cosmo_auth', qToken);
    } catch {
      // ignore
    }
    return qToken;
  }

  // Check localStorage
  try {
    const saved = localStorage.getItem('cosmo_auth');
    if (saved) return saved;
  } catch {
    // ignore
  }

  return '';
}

export function isTelegramOrAuthorized(): boolean {
  if (typeof window === 'undefined') return false;

  // In Telegram Mini App, initData is present
  const tgInitData = (window as any).Telegram?.WebApp?.initData;
  if (tgInitData && typeof tgInitData === 'string' && tgInitData.length > 5) {
    return true;
  }

  // Or secret auth token exists
  return !!getAuthToken();
}

function getHeaders(custom: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...custom };

  if (typeof window !== 'undefined') {
    const tgInitData = (window as any).Telegram?.WebApp?.initData;
    if (tgInitData && typeof tgInitData === 'string' && tgInitData.length > 0) {
      headers['X-Telegram-Init-Data'] = tgInitData;
    }

    const token = getAuthToken();
    if (token) {
      headers['X-Cosmo-Auth'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

export const api = {
  async getOverview(): Promise<OverviewResponse> {
    const res = await fetch(`${API_BASE}/api/v1/overview`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Overview fetch failed: ${res.statusText}`);
    return res.json();
  },

  async getKeys(): Promise<VpnKey[]> {
    const res = await fetch(`${API_BASE}/api/v1/keys`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Keys fetch failed: ${res.statusText}`);
    return res.json();
  },

  async createKey(key: VpnKey): Promise<VpnKey> {
    const res = await fetch(`${API_BASE}/api/v1/keys`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(key),
    });
    if (!res.ok) throw new Error(`Create key failed: ${res.statusText}`);
    return res.json();
  },

  async toggleKey(id: string, enabled: boolean): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/keys/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(`Toggle key failed: ${res.statusText}`);
  },

  async deleteKey(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Delete key failed: ${res.statusText}`);
  },

  async getSubscriptionHeaders(): Promise<SubscriptionHeaders> {
    const res = await fetch(`${API_BASE}/api/v1/subscription`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Subscription fetch failed: ${res.statusText}`);
    return res.json();
  },

  async saveSubscriptionHeaders(headers: SubscriptionHeaders): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/subscription/headers`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(headers),
    });
    if (!res.ok) throw new Error(`Save headers failed: ${res.statusText}`);
  },

  async getSettings(): Promise<HostSettings> {
    const res = await fetch(`${API_BASE}/api/v1/settings`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Settings fetch failed: ${res.statusText}`);
    return res.json();
  },

  async saveSettings(settings: HostSettings): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/settings`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Save settings failed: ${res.statusText}`);
  },

  async renewAcme(): Promise<string> {
    const res = await fetch(`${API_BASE}/api/v1/settings/acme/renew`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `ACME renew failed: ${res.statusText}`);
    }
    return res.text();
  },

  async restartCores(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/core/restart`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Restart cores failed: ${res.statusText}`);
  },
};

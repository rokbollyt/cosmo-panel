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

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  const clean = token.trim();
  if (!clean) return;
  try {
    localStorage.setItem('cosmo_auth', clean);
    sessionStorage.setItem('cosmo_auth', clean);
    document.cookie = `cosmo_auth=${encodeURIComponent(clean)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore
  }
}

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';

  // 1. Check URL query param ?auth=...
  const urlParams = new URLSearchParams(window.location.search);
  const qToken = urlParams.get('auth');
  if (qToken && qToken.trim().length > 0) {
    setAuthToken(qToken.trim());
    return qToken.trim();
  }

  // 2. Check URL hash #auth=... or #token=...
  if (window.location.hash.includes('auth=') || window.location.hash.includes('token=')) {
    const rawHash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(rawHash);
    const hToken = hashParams.get('auth') || hashParams.get('token');
    if (hToken && hToken.trim().length > 0) {
      setAuthToken(hToken.trim());
      return hToken.trim();
    }
  }

  // 3. Check localStorage
  try {
    const saved = localStorage.getItem('cosmo_auth');
    if (saved && saved.trim().length > 0) return saved.trim();
  } catch {
    // ignore
  }

  // 4. Check sessionStorage
  try {
    const sessionSaved = sessionStorage.getItem('cosmo_auth');
    if (sessionSaved && sessionSaved.trim().length > 0) return sessionSaved.trim();
  } catch {
    // ignore
  }

  // 5. Check cookies
  try {
    const match = document.cookie.match(/(?:^|;\s*)cosmo_auth=([^;]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.trim().length > 0) return decoded.trim();
    }
  } catch {
    // ignore
  }

  return '';
}

export function getTelegramInitData(): string {
  if (typeof window === 'undefined') return '';

  const sdkData = (window as any).Telegram?.WebApp?.initData;
  if (sdkData && typeof sdkData === 'string' && sdkData.trim().length > 0) {
    return sdkData.trim();
  }

  // Parse from URL hash: #tgWebAppData=...
  if (window.location.hash.includes('tgWebAppData=')) {
    const rawHash = window.location.hash.replace(/^#/, '');
    const searchParams = new URLSearchParams(rawHash);
    const data = searchParams.get('tgWebAppData');
    if (data && data.trim().length > 0) return data.trim();
  }

  // Or from query params
  const searchParams = new URLSearchParams(window.location.search);
  const qData = searchParams.get('tgWebAppData');
  if (qData && qData.trim().length > 0) return qData.trim();

  return '';
}

export function isTelegramOrAuthorized(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Direct admin auth token
  if (getAuthToken().length > 0) return true;

  // 2. Valid Telegram Mini App session data
  const tgData = getTelegramInitData();
  if (tgData.length > 0) return true;

  // In all other cases (e.g. regular browser without auth token): NOT AUTHORIZED
  return false;
}

function getHeaders(custom: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...custom };

  if (typeof window !== 'undefined') {
    const tgInitData = getTelegramInitData();
    if (tgInitData) {
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

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

export const api = {
  async getOverview(): Promise<OverviewResponse> {
    const res = await fetch(`${API_BASE}/api/v1/overview`);
    if (!res.ok) throw new Error(`Overview fetch failed: ${res.statusText}`);
    return res.json();
  },

  async getKeys(): Promise<VpnKey[]> {
    const res = await fetch(`${API_BASE}/api/v1/keys`);
    if (!res.ok) throw new Error(`Keys fetch failed: ${res.statusText}`);
    return res.json();
  },

  async createKey(key: VpnKey): Promise<VpnKey> {
    const res = await fetch(`${API_BASE}/api/v1/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(key),
    });
    if (!res.ok) throw new Error(`Create key failed: ${res.statusText}`);
    return res.json();
  },

  async toggleKey(id: string, enabled: boolean): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/keys/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(`Toggle key failed: ${res.statusText}`);
  },

  async deleteKey(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Delete key failed: ${res.statusText}`);
  },

  async getSubscriptionHeaders(): Promise<SubscriptionHeaders> {
    const res = await fetch(`${API_BASE}/api/v1/subscription`);
    if (!res.ok) throw new Error(`Subscription fetch failed: ${res.statusText}`);
    return res.json();
  },

  async saveSubscriptionHeaders(headers: SubscriptionHeaders): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/subscription/headers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(headers),
    });
    if (!res.ok) throw new Error(`Save headers failed: ${res.statusText}`);
  },

  async getSettings(): Promise<HostSettings> {
    const res = await fetch(`${API_BASE}/api/v1/settings`);
    if (!res.ok) throw new Error(`Settings fetch failed: ${res.statusText}`);
    return res.json();
  },

  async saveSettings(settings: HostSettings): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Save settings failed: ${res.statusText}`);
  },

  async renewAcme(): Promise<string> {
    const res = await fetch(`${API_BASE}/api/v1/settings/acme/renew`, {
      method: 'POST',
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
    });
    if (!res.ok) throw new Error(`Restart cores failed: ${res.statusText}`);
  },
};

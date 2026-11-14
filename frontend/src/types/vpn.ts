// ============================================================================
// ТИПЫ И СХЕМЫ ДАННЫХ ДЛЯ ADMIN VPN PANEL (FRONTEND)
// Все структуры подготовлены для прямой сериализации в REST/gRPC API бэкенда
// ============================================================================

export type ProtocolType = 'vless' | 'hysteria2' | 'mtproxy' | 'socks5';

export type TabId = 'overview' | 'keys' | 'subscription' | 'settings';

// --- Параметры создания VLESS на хосте ---
export interface VlessConfig {
  port: number;
  uuid: string;
  network: 'tcp' | 'grpc' | 'ws' | 'xhttp';
  security: 'reality' | 'tls' | 'none';
  flow: 'xtls-rprx-vision' | 'none';
  // Reality-специфичные поля
  realityDest: string;
  realitySni: string;
  fingerprint: 'chrome' | 'firefox' | 'safari' | 'ios' | 'random';
  privateKey: string;
  publicKey: string;
  shortId: string;
  spiderX: string;
  // TLS / WS / gRPC поля
  tlsDomain: string;
  useAutoCert: boolean;
  alpn: string;
  path: string;
}

// --- Параметры создания Hysteria2 на хосте ---
export interface Hysteria2Config {
  port: number;
  portHopping: string; // например "20000-50000" или пусто
  password: string;
  obfs: 'none' | 'salamander';
  obfsPassword: string;
  sni: string;
  masqueradeUrl: string;
  useAutoCert: boolean;
  insecure: boolean;
  upMbps: number;
  downMbps: number;
}

// --- Параметры создания MTProxy (Telegram) на хосте ---
export interface MtProxyConfig {
  port: number;
  mode: 'fake-tls' | 'secure' | 'classic';
  secret: string; // 32 hex символа (базовый секрет)
  fakeTlsDomain: string;
  adTag: string;
  workers: number;
}

// --- Параметры создания SOCKS5 на хосте ---
export interface Socks5Config {
  port: number;
  authMode: 'password' | 'none';
  username: string;
  password: string;
  udpAssociate: boolean;
  bindAddress: string;
  allowlistCidr: string;
  tlsWrap: boolean;
}

export type ProtocolConfigMap = {
  vless: VlessConfig;
  hysteria2: Hysteria2Config;
  mtproxy: MtProxyConfig;
  socks5: Socks5Config;
};

export interface VpnKey<T extends ProtocolType = ProtocolType> {
  id: string;
  name: string;
  protocol: T;
  /** Включён ли ключ на хосте и отдаётся ли в единой подписке /sub */
  enabled: boolean;
  createdAt: string;
  config: ProtocolConfigMap[T];
}

// --- Настройки единой подписки /sub ---
export interface SubscriptionHeaders {
  /** #anonce — объявление / статус-баннер в VPN-клиенте */
  anonce: string;
  /** #profile-title: [string] — заголовок профиля в клиенте */
  profileTitle: string;
  /** Кодировать profile-title в base64: (удобно для кириллицы в Happ / v2rayTun) */
  encodeTitleBase64: boolean;
  /** #support-url: — ссылка на поддержку (Telegram/сайт) */
  supportUrl: string;
  /** #profile-web-page-url: — веб-страница профиля / панели */
  profileWebPageUrl: string;
}

// --- Настройки хоста и авто-сертификатов ---
export interface HostSettings {
  domain: string;
  acmeEnabled: boolean;
  acmeEmail: string;
  acmeChallenge: 'http-01' | 'tls-alpn-01' | 'dns-01';
  certStatus: 'active' | 'renewing' | 'pending';
  certIssuer: string;
  certExpiresAt: string;
  bbrEnabled: boolean;
  ipv6Enabled: boolean;
  fallbackSite: string;
  adminTelegramIds: string;
  coreVersion: string;
}

export interface TrafficPoint {
  label: string;
  totalGb: number;
  downGb: number;
  upGb: number;
}

export const PROTOCOL_META: Record<
  ProtocolType,
  { label: string; shortLabel: string; description: string }
> = {
  vless: {
    label: 'VLESS',
    shortLabel: 'VLESS',
    description: 'Xray Reality / TLS / Vision',
  },
  hysteria2: {
    label: 'Hysteria2',
    shortLabel: 'Hysteria',
    description: 'QUIC / UDP / Salamander',
  },
  mtproxy: {
    label: 'MTProxy',
    shortLabel: 'MTProxy',
    description: 'Telegram Fake-TLS Proxy',
  },
  socks5: {
    label: 'SOCKS5',
    shortLabel: 'SOCKS5',
    description: 'TCP / UDP Proxy Tunnel',
  },
};

// ============================================================================
// ГЕНЕРАТОРЫ КРИПТОПАРАМЕТРОВ (ДЛЯ UI СОЗДАНИЯ КЛЮЧЕЙ НА ХОСТЕ)
// При подключении бэкенда X25519 ключи также можно генерировать через API хоста
// ============================================================================

export function generateHex(length: number): string {
  const chars = '0123456789abcdef';
  const arr = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => chars[b % 16]).join('');
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const h = generateHex(32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function generateBase64UrlKey(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePassword(length = 18): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const arr = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => alphabet[b % alphabet.length]).join('');
}

export function encodeUtf8Base64(text: string): string {
  try {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin);
  } catch {
    return text;
  }
}

function stringToHex(str: string): string {
  return Array.from(str)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Генерирует клиентскую строку подключения для предпросмотра и вывода в /sub
 */
export function buildKeyUri(key: VpnKey, hostDomain: string): string {
  const host = hostDomain.trim() || 'node.example.com';
  const remark = encodeURIComponent(key.name);

  if (key.protocol === 'vless') {
    const c = key.config as VlessConfig;
    const params = new URLSearchParams();
    params.set('encryption', 'none');
    params.set('type', c.network);
    params.set('security', c.security);
    if (c.flow !== 'none' && c.network === 'tcp') {
      params.set('flow', c.flow);
    }
    if (c.security === 'reality') {
      params.set('sni', c.realitySni || 'www.microsoft.com');
      params.set('fp', c.fingerprint);
      params.set('pbk', c.publicKey);
      if (c.shortId) params.set('sid', c.shortId);
      if (c.spiderX) params.set('spx', c.spiderX);
    } else if (c.security === 'tls') {
      params.set('sni', c.tlsDomain || host);
      if (c.alpn) params.set('alpn', c.alpn);
    }
    if (c.network === 'ws' || c.network === 'xhttp' || c.network === 'grpc') {
      if (c.path) params.set(c.network === 'grpc' ? 'serviceName' : 'path', c.path);
    }
    return `vless://${c.uuid}@${host}:${c.port}?${params.toString()}#${remark}`;
  }

  if (key.protocol === 'hysteria2') {
    const c = key.config as Hysteria2Config;
    const params = new URLSearchParams();
    if (c.sni) params.set('sni', c.sni);
    if (c.obfs === 'salamander' && c.obfsPassword) {
      params.set('obfs', 'salamander');
      params.set('obfs-password', c.obfsPassword);
    }
    if (c.insecure) params.set('insecure', '1');
    if (c.portHopping.trim()) params.set('mport', c.portHopping.trim());
    return `hysteria2://${encodeURIComponent(c.password)}@${host}:${c.port}?${params.toString()}#${remark}`;
  }

  if (key.protocol === 'mtproxy') {
    const c = key.config as MtProxyConfig;
    let fullSecret = c.secret;
    if (c.mode === 'fake-tls') {
      fullSecret = `ee${c.secret}${stringToHex(c.fakeTlsDomain || 'cloudflare.com')}`;
    } else if (c.mode === 'secure') {
      fullSecret = `dd${c.secret}`;
    }
    return `tg://proxy?server=${host}&port=${c.port}&secret=${fullSecret}`;
  }

  // SOCKS5
  const c = key.config as Socks5Config;
  const auth =
    c.authMode === 'password' && c.username
      ? `${encodeURIComponent(c.username)}:${encodeURIComponent(c.password)}@`
      : '';
  return `socks5://${auth}${host}:${c.port}#${remark}`;
}

/**
 * Генерирует заголовочную часть ответа эндпоинта /sub
 */
export function buildSubscriptionHeadersText(headers: SubscriptionHeaders): string {
  const lines: string[] = [];
  const titleVal = headers.profileTitle.trim();
  if (titleVal) {
    lines.push(
      `#profile-title: ${headers.encodeTitleBase64 ? `base64:${encodeUtf8Base64(titleVal)}` : titleVal}`
    );
  }
  if (headers.anonce.trim()) {
    lines.push(`#anonce: ${headers.anonce.trim()}`);
  }
  if (headers.supportUrl.trim()) {
    lines.push(`#support-url: ${headers.supportUrl.trim()}`);
  }
  if (headers.profileWebPageUrl.trim()) {
    lines.push(`#profile-web-page-url: ${headers.profileWebPageUrl.trim()}`);
  }
  return lines.join('\n');
}

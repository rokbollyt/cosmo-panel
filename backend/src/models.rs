use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProtocolType {
    Vless,
    Hysteria2,
    Mtproxy,
    Socks5,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VlessConfig {
    pub port: u16,
    pub uuid: String,
    pub network: String,          // tcp, grpc, ws, xhttp
    pub security: String,         // reality, tls, none
    pub flow: String,             // xtls-rprx-vision, none
    pub reality_dest: String,     // e.g. www.microsoft.com:443
    pub reality_sni: String,      // e.g. www.microsoft.com
    pub fingerprint: String,      // chrome, firefox, safari, ios, random
    pub private_key: String,
    pub public_key: String,
    pub short_id: String,
    pub spider_x: String,
    pub tls_domain: String,
    pub use_auto_cert: bool,
    pub alpn: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hysteria2Config {
    pub port: u16,
    pub port_hopping: String,     // e.g. 20000-50000
    pub password: String,
    pub obfs: String,             // none, salamander
    pub obfs_password: String,
    pub sni: String,
    pub masquerade_url: String,
    pub use_auto_cert: bool,
    pub insecure: bool,
    pub up_mbps: u32,
    pub down_mbps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MtProxyConfig {
    pub port: u16,
    pub mode: String,             // fake-tls, secure, classic
    pub secret: String,           // 32 hex chars
    pub fake_tls_domain: String,
    pub ad_tag: String,
    pub workers: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Socks5Config {
    pub port: u16,
    pub auth_mode: String,        // password, none
    pub username: String,
    pub password: String,
    pub udp_associate: bool,
    pub bind_address: String,
    pub allowlist_cidr: String,
    pub tls_wrap: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
#[allow(dead_code)]
pub enum ProtocolConfig {
    Vless(VlessConfig),
    Hysteria2(Hysteria2Config),
    Mtproxy(MtProxyConfig),
    Socks5(Socks5Config),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnKey {
    pub id: String,
    pub name: String,
    pub protocol: ProtocolType,
    pub enabled: bool,
    #[serde(default)]
    pub created_at: String,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionHeaders {
    pub anonce: String,
    pub profile_title: String,
    pub encode_title_base64: bool,
    pub support_url: String,
    pub profile_web_page_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSettings {
    pub domain: String,
    pub acme_enabled: bool,
    pub acme_email: String,
    pub acme_challenge: String,   // http-01, tls-alpn-01, dns-01
    pub cert_status: String,      // active, renewing, pending
    pub cert_issuer: String,
    pub cert_expires_at: String,
    pub bbr_enabled: bool,
    pub ipv6_enabled: bool,
    pub fallback_site: String,
    pub admin_telegram_ids: String,
    pub core_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrafficPoint {
    pub label: String,
    pub total_gb: f64,
    pub down_gb: f64,
    pub up_gb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    pub uptime_seconds: u64,
    pub cpu_usage_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub active_keys_count: usize,
    pub total_keys_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewData {
    pub stats: SystemStats,
    pub traffic_series: Vec<TrafficPoint>,
}

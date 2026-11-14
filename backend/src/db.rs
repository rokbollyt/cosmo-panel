use crate::models::{HostSettings, SubscriptionHeaders, TrafficPoint, VpnKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppData {
    pub keys: Vec<VpnKey>,
    pub subscription_headers: SubscriptionHeaders,
    pub host_settings: HostSettings,
    pub traffic_points: Vec<TrafficPoint>,
    pub admin_claimed: bool,
    #[serde(default = "default_token")]
    pub admin_secret_token: String,
}

fn default_token() -> String {
    let mut bytes = [0u8; 16];
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    for (i, b) in bytes.iter_mut().enumerate() {
        *b = ((now >> (i * 8)) & 0xff) as u8 ^ ((i as u8) * 31 + 7);
    }
    hex::encode(bytes)
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            keys: Vec::new(),
            subscription_headers: SubscriptionHeaders {
                anonce: "Cosmo VPN · High Performance Tunnel".to_string(),
                profile_title: "Cosmo Private Net".to_string(),
                encode_title_base64: true,
                support_url: "https://t.me/".to_string(),
                profile_web_page_url: "https://t.me/".to_string(),
            },
            host_settings: HostSettings {
                domain: "".to_string(),
                acme_enabled: true,
                acme_email: "".to_string(),
                acme_challenge: "http-01".to_string(),
                cert_status: "pending".to_string(),
                cert_issuer: "Let's Encrypt".to_string(),
                cert_expires_at: "".to_string(),
                bbr_enabled: true,
                ipv6_enabled: true,
                fallback_site: "https://www.microsoft.com".to_string(),
                admin_telegram_ids: "".to_string(),
                core_version: "sing-box 1.11.4 / mtg 2.1.7".to_string(),
            },
            traffic_points: vec![
                TrafficPoint { label: "00:00".into(), total_gb: 1.2, down_gb: 0.9, up_gb: 0.3 },
                TrafficPoint { label: "04:00".into(), total_gb: 0.8, down_gb: 0.6, up_gb: 0.2 },
                TrafficPoint { label: "08:00".into(), total_gb: 3.4, down_gb: 2.8, up_gb: 0.6 },
                TrafficPoint { label: "12:00".into(), total_gb: 5.6, down_gb: 4.4, up_gb: 1.2 },
                TrafficPoint { label: "16:00".into(), total_gb: 7.8, down_gb: 6.2, up_gb: 1.6 },
                TrafficPoint { label: "20:00".into(), total_gb: 9.1, down_gb: 7.5, up_gb: 1.6 },
            ],
            admin_claimed: false,
            admin_secret_token: default_token(),
        }
    }
}

pub struct Db {
    file_path: PathBuf,
    pub state: Arc<RwLock<AppData>>,
}

impl Db {
    pub fn load_or_init<P: AsRef<Path>>(path: P) -> Self {
        let p = path.as_ref().to_path_buf();
        if let Some(parent) = p.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let mut data = if p.exists() {
            match fs::read_to_string(&p) {
                Ok(content) => match serde_json::from_str::<AppData>(&content) {
                    Ok(parsed) => parsed,
                    Err(e) => {
                        eprintln!("[Db] Corrupted state file {:?}: {}, using default", p, e);
                        AppData::default()
                    }
                },
                Err(e) => {
                    eprintln!("[Db] Cannot read state file {:?}: {}, using default", p, e);
                    AppData::default()
                }
            }
        } else {
            let def = AppData::default();
            let _ = fs::write(&p, serde_json::to_string_pretty(&def).unwrap_or_default());
            def
        };

        if data.admin_secret_token.is_empty() {
            data.admin_secret_token = default_token();
            let _ = fs::write(&p, serde_json::to_string_pretty(&data).unwrap_or_default());
        }

        Self {
            file_path: p,
            state: Arc::new(RwLock::new(data)),
        }
    }

    pub fn save_data(&self, snapshot: &AppData) -> Result<(), std::io::Error> {
        let json = serde_json::to_string_pretty(snapshot)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        let tmp_path = self.file_path.with_extension("tmp");
        fs::write(&tmp_path, json)?;
        fs::rename(&tmp_path, &self.file_path)?;
        Ok(())
    }

    pub async fn save(&self) -> Result<(), std::io::Error> {
        let snapshot = {
            let guard = self.state.read().await;
            guard.clone()
        };
        self.save_data(&snapshot)
    }
}

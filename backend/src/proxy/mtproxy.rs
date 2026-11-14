use crate::models::{MtProxyConfig, ProtocolType, VpnKey};
use std::fmt::Write;

pub struct MtgCmd {
    pub port: u16,
    pub secret: String,
}

pub fn extract_mtproxy_config(keys: &[VpnKey]) -> Option<MtgCmd> {
    for key in keys.iter().filter(|k| k.enabled && k.protocol == ProtocolType::Mtproxy) {
        if let Ok(c) = serde_json::from_value::<MtProxyConfig>(key.config.clone()) {
            let mut full_secret = c.secret.clone();
            if c.mode == "fake-tls" {
                let domain = if c.fake_tls_domain.is_empty() {
                    "cloudflare.com"
                } else {
                    &c.fake_tls_domain
                };
                let mut hex_domain = String::new();
                for b in domain.as_bytes() {
                    let _ = write!(&mut hex_domain, "{:02x}", b);
                }
                full_secret = format!("ee{}{}", c.secret, hex_domain);
            } else if c.mode == "secure" {
                full_secret = format!("dd{}", c.secret);
            }

            return Some(MtgCmd {
                port: c.port,
                secret: full_secret,
            });
        }
    }
    None
}

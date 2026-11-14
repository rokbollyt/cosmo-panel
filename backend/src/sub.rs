use crate::models::{Hysteria2Config, MtProxyConfig, ProtocolType, Socks5Config, SubscriptionHeaders, VlessConfig, VpnKey};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::fmt::Write;

pub fn build_key_uri(key: &VpnKey, host_domain: &str) -> String {
    let host = if host_domain.trim().is_empty() {
        "127.0.0.1"
    } else {
        host_domain.trim()
    };
    let remark = urlencoding::encode(&key.name);

    match key.protocol {
        ProtocolType::Vless => {
            if let Ok(c) = serde_json::from_value::<VlessConfig>(key.config.clone()) {
                let mut params = Vec::new();
                params.push(("encryption", "none".to_string()));
                params.push(("type", c.network.clone()));
                params.push(("security", c.security.clone()));
                if c.flow != "none" && c.network == "tcp" {
                    params.push(("flow", c.flow.clone()));
                }
                if c.security == "reality" {
                    let sni = if c.reality_sni.is_empty() { "www.microsoft.com" } else { &c.reality_sni };
                    params.push(("sni", sni.to_string()));
                    params.push(("fp", c.fingerprint.clone()));
                    params.push(("pbk", c.public_key.clone()));
                    if !c.short_id.is_empty() {
                        params.push(("sid", c.short_id.clone()));
                    }
                    if !c.spider_x.is_empty() {
                        params.push(("spx", c.spider_x.clone()));
                    }
                } else if c.security == "tls" {
                    let sni = if c.tls_domain.is_empty() { host } else { &c.tls_domain };
                    params.push(("sni", sni.to_string()));
                    if !c.alpn.is_empty() {
                        params.push(("alpn", c.alpn.clone()));
                    }
                }
                if (c.network == "ws" || c.network == "xhttp" || c.network == "grpc") && !c.path.is_empty() {
                    let key_name = if c.network == "grpc" { "serviceName" } else { "path" };
                    params.push((key_name, c.path.clone()));
                }

                let qs = params
                    .into_iter()
                    .map(|(k, v)| format!("{}={}", k, urlencoding::encode(&v)))
                    .collect::<Vec<_>>()
                    .join("&");

                format!("vless://{}@{}:{}?{}#{}", c.uuid, host, c.port, qs, remark)
            } else {
                String::new()
            }
        }
        ProtocolType::Hysteria2 => {
            if let Ok(c) = serde_json::from_value::<Hysteria2Config>(key.config.clone()) {
                let mut params = Vec::new();
                if !c.sni.is_empty() {
                    params.push(("sni", c.sni.clone()));
                }
                if c.obfs == "salamander" && !c.obfs_password.is_empty() {
                    params.push(("obfs", "salamander".to_string()));
                    params.push(("obfs-password", c.obfs_password.clone()));
                }
                if c.insecure {
                    params.push(("insecure", "1".to_string()));
                }
                if !c.port_hopping.trim().is_empty() {
                    params.push(("mport", c.port_hopping.trim().to_string()));
                }

                let qs = params
                    .into_iter()
                    .map(|(k, v)| format!("{}={}", k, urlencoding::encode(&v)))
                    .collect::<Vec<_>>()
                    .join("&");

                format!(
                    "hysteria2://{}@{}:{}?{}#{}",
                    urlencoding::encode(&c.password),
                    host,
                    c.port,
                    qs,
                    remark
                )
            } else {
                String::new()
            }
        }
        ProtocolType::Mtproxy => {
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
                format!(
                    "tg://proxy?server={}&port={}&secret={}",
                    host, c.port, full_secret
                )
            } else {
                String::new()
            }
        }
        ProtocolType::Socks5 => {
            if let Ok(c) = serde_json::from_value::<Socks5Config>(key.config.clone()) {
                let auth = if c.auth_mode == "password" && !c.username.is_empty() {
                    format!(
                        "{}:{}@",
                        urlencoding::encode(&c.username),
                        urlencoding::encode(&c.password)
                    )
                } else {
                    String::new()
                };
                format!("socks5://{}{}:{}#{}", auth, host, c.port, remark)
            } else {
                String::new()
            }
        }
    }
}

pub fn generate_subscription_body(
    headers: &SubscriptionHeaders,
    keys: &[VpnKey],
    host_domain: &str,
) -> String {
    let mut lines = Vec::new();

    let title_val = headers.profile_title.trim();
    if !title_val.is_empty() {
        if headers.encode_title_base64 {
            let b64 = BASE64.encode(title_val.as_bytes());
            lines.push(format!("#profile-title: base64:{}", b64));
        } else {
            lines.push(format!("#profile-title: {}", title_val));
        }
    }

    if !headers.anonce.trim().is_empty() {
        lines.push(format!("#anonce: {}", headers.anonce.trim()));
    }
    if !headers.support_url.trim().is_empty() {
        lines.push(format!("#support-url: {}", headers.support_url.trim()));
    }
    if !headers.profile_web_page_url.trim().is_empty() {
        lines.push(format!(
            "#profile-web-page-url: {}",
            headers.profile_web_page_url.trim()
        ));
    }

    // Enabled keys only
    for key in keys.iter().filter(|k| k.enabled) {
        let uri = build_key_uri(key, host_domain);
        if !uri.is_empty() {
            lines.push(uri);
        }
    }

    lines.join("\n")
}

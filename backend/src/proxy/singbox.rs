use crate::models::{Hysteria2Config, ProtocolType, Socks5Config, VlessConfig, VpnKey};
use serde_json::{json, Value};
use std::path::Path;

pub fn generate_singbox_config(
    keys: &[VpnKey],
    cert_path: Option<&Path>,
    key_path: Option<&Path>,
) -> Value {
    let mut inbounds: Vec<Value> = Vec::new();

    for key in keys.iter().filter(|k| k.enabled) {
        match key.protocol {
            ProtocolType::Vless => {
                if let Ok(c) = serde_json::from_value::<VlessConfig>(key.config.clone()) {
                    let mut user_obj = json!({
                        "name": key.name,
                        "uuid": c.uuid,
                    });
                    if c.flow != "none" && c.network == "tcp" {
                        user_obj["flow"] = json!(c.flow);
                    }

                    let mut inbound = json!({
                        "type": "vless",
                        "tag": format!("vless-{}", key.id),
                        "listen": "::",
                        "listen_port": c.port,
                        "users": [user_obj]
                    });

                    if c.security == "reality" {
                        let (dest_host, dest_port) = match c.reality_dest.split_once(':') {
                            Some((h, p)) => (h, p.parse::<u16>().unwrap_or(443)),
                            None => (c.reality_dest.as_str(), 443),
                        };

                        let short_ids = if c.short_id.is_empty() {
                            vec![]
                        } else {
                            vec![c.short_id.clone()]
                        };

                        inbound["tls"] = json!({
                            "enabled": true,
                            "server_name": if c.reality_sni.is_empty() { "www.microsoft.com" } else { &c.reality_sni },
                            "reality": {
                                "enabled": true,
                                "handshake": {
                                    "server": dest_host,
                                    "server_port": dest_port
                                },
                                "private_key": c.private_key,
                                "short_id": short_ids
                            }
                        });
                    } else if c.security == "tls" {
                        if let (Some(cp), Some(kp)) = (cert_path, key_path) {
                            inbound["tls"] = json!({
                                "enabled": true,
                                "server_name": if c.tls_domain.is_empty() { "localhost" } else { &c.tls_domain },
                                "certificate_path": cp.to_string_lossy(),
                                "key_path": kp.to_string_lossy()
                            });
                        }
                    }

                    if c.network == "ws" {
                        inbound["transport"] = json!({
                            "type": "ws",
                            "path": if c.path.is_empty() { "/ws" } else { &c.path }
                        });
                    } else if c.network == "grpc" {
                        inbound["transport"] = json!({
                            "type": "grpc",
                            "service_name": if c.path.is_empty() { "default" } else { &c.path }
                        });
                    }

                    inbounds.push(inbound);
                }
            }
            ProtocolType::Hysteria2 => {
                if let Ok(c) = serde_json::from_value::<Hysteria2Config>(key.config.clone()) {
                    let mut inbound = json!({
                        "type": "hysteria2",
                        "tag": format!("hy2-{}", key.id),
                        "listen": "::",
                        "listen_port": c.port,
                        "users": [
                            {
                                "name": key.name,
                                "password": c.password
                            }
                        ]
                    });

                    if c.obfs == "salamander" && !c.obfs_password.is_empty() {
                        inbound["obfs"] = json!({
                            "type": "salamander",
                            "password": c.obfs_password
                        });
                    }

                    if let (Some(cp), Some(kp)) = (cert_path, key_path) {
                        inbound["tls"] = json!({
                            "enabled": true,
                            "certificate_path": cp.to_string_lossy(),
                            "key_path": kp.to_string_lossy()
                        });
                    }

                    let clean_masq = c.masquerade_url.trim();
                    if !clean_masq.is_empty() {
                        let formatted_masq = if clean_masq.starts_with("http://")
                            || clean_masq.starts_with("https://")
                            || clean_masq.starts_with("file://")
                        {
                            clean_masq.to_string()
                        } else {
                            format!("https://{}", clean_masq)
                        };
                        inbound["masquerade"] = json!(formatted_masq);
                    }

                    if c.up_mbps > 0 {
                        inbound["up_mbps"] = json!(c.up_mbps);
                    }
                    if c.down_mbps > 0 {
                        inbound["down_mbps"] = json!(c.down_mbps);
                    }

                    inbounds.push(inbound);
                }
            }
            ProtocolType::Socks5 => {
                if let Ok(c) = serde_json::from_value::<Socks5Config>(key.config.clone()) {
                    let mut inbound = json!({
                        "type": "socks",
                        "tag": format!("socks-{}", key.id),
                        "listen": if c.bind_address.is_empty() { "0.0.0.0" } else { &c.bind_address },
                        "listen_port": c.port,
                    });

                    if c.auth_mode == "password" && !c.username.is_empty() {
                        inbound["users"] = json!([
                            {
                                "username": c.username,
                                "password": c.password
                            }
                        ]);
                    }

                    inbounds.push(inbound);
                }
            }
            ProtocolType::Mtproxy => {
                // Handled via MTG daemon
            }
        }
    }

    json!({
        "log": {
            "level": "info",
            "timestamp": true
        },
        "inbounds": inbounds,
        "outbounds": [
            {
                "type": "direct",
                "tag": "direct"
            },
            {
                "type": "block",
                "tag": "block"
            }
        ]
    })
}

use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::collections::BTreeMap;
use tracing::warn;

type HmacSha256 = Hmac<Sha256>;

pub fn verify_telegram_init_data(init_data: &str, bot_token: &str, admin_ids: &str) -> bool {
    if init_data.trim().is_empty() || bot_token.trim().is_empty() {
        return false;
    }

    let mut params = BTreeMap::new();
    let mut expected_hash = String::new();

    for part in init_data.split('&') {
        if let Some((k, v)) = part.split_once('=') {
            if k == "hash" {
                expected_hash = v.to_string();
            } else {
                if let Ok(decoded_val) = urlencoding::decode(v) {
                    params.insert(k.to_string(), decoded_val.to_string());
                } else {
                    params.insert(k.to_string(), v.to_string());
                }
            }
        }
    }

    if expected_hash.is_empty() {
        return false;
    }

    // Build data_check_string: sorted key=value joined by \n
    let data_check_string = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("\n");

    // Secret key = HMAC_SHA256("WebAppData", bot_token)
    let Ok(mut secret_mac) = HmacSha256::new_from_slice(b"WebAppData") else {
        return false;
    };
    secret_mac.update(bot_token.as_bytes());
    let secret_key = secret_mac.finalize().into_bytes();

    // Compute check hash = HMAC_SHA256(data_check_string, secret_key)
    let Ok(mut check_mac) = HmacSha256::new_from_slice(&secret_key) else {
        return false;
    };
    check_mac.update(data_check_string.as_bytes());
    let computed_hash = hex::encode(check_mac.finalize().into_bytes());

    if computed_hash.to_lowercase() != expected_hash.to_lowercase() {
        warn!("[Auth] Telegram initData hash mismatch!");
        return false;
    }

    // Verify user ID if admin_ids is configured
    let clean_admins = admin_ids.trim();
    if clean_admins.is_empty() || clean_admins == "0" {
        // Admin not yet claimed, allow initial setup
        return true;
    }

    if let Some(user_json) = params.get("user") {
        if let Ok(user_val) = serde_json::from_str::<serde_json::Value>(user_json) {
            if let Some(user_id) = user_val.get("id").and_then(|id| id.as_i64()) {
                let user_id_str = user_id.to_string();
                return clean_admins
                    .split(',')
                    .any(|part| part.trim() == user_id_str);
            }
        }
    }

    false
}

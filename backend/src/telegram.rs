use crate::db::Db;
use crate::sub::generate_subscription_body;
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, info, warn};

pub struct TelegramBot {
    token: String,
    db: Arc<Db>,
    client: Client,
    panel_url: String,
}

impl TelegramBot {
    pub fn new(token: String, db: Arc<Db>, panel_url: String) -> Self {
        Self {
            token,
            db,
            client: Client::builder()
                .timeout(Duration::from_secs(45))
                .build()
                .unwrap_or_default(),
            panel_url,
        }
    }

    pub async fn run_loop(self: Arc<Self>) {
        if self.token.trim().is_empty() {
            info!("[Telegram] No bot token configured, skipping telegram bot listener.");
            return;
        }

        info!("[Telegram] Starting Telegram Bot polling loop...");

        // Try to setup chat menu button for WebApp
        self.setup_menu_button().await;

        let mut offset: i64 = 0;

        loop {
            let url = format!(
                "https://api.telegram.org/bot{}/getUpdates?offset={}&timeout=25",
                self.token, offset
            );

            match self.client.get(&url).send().await {
                Ok(resp) => {
                    if let Ok(json_val) = resp.json::<serde_json::Value>().await {
                        if let Some(result_arr) = json_val["result"].as_array() {
                            for update in result_arr {
                                if let Some(upd_id) = update["update_id"].as_i64() {
                                    offset = upd_id + 1;
                                }

                                if let Some(msg) = update["message"].as_object() {
                                    let bot = self.clone();
                                    let msg_val = serde_json::Value::Object(msg.clone());
                                    tokio::spawn(async move {
                                        bot.handle_message(msg_val).await;
                                    });
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("[Telegram] getUpdates network error: {}", e);
                    sleep(Duration::from_secs(5)).await;
                }
            }

            sleep(Duration::from_millis(500)).await;
        }
    }

    async fn get_authed_panel_url(&self) -> String {
        let secret_token = {
            let guard = self.db.state.read().await;
            guard.admin_secret_token.clone()
        };
        if secret_token.is_empty() {
            self.panel_url.clone()
        } else if self.panel_url.contains('?') {
            format!("{}&auth={}", self.panel_url, secret_token)
        } else {
            format!("{}?auth={}", self.panel_url, secret_token)
        }
    }

    async fn setup_menu_button(&self) {
        if self.panel_url.trim().is_empty() {
            return;
        }

        let app_url = self.get_authed_panel_url().await;

        let url = format!(
            "https://api.telegram.org/bot{}/setChatMenuButton",
            self.token
        );
        let payload = json!({
            "menu_button": {
                "type": "web_app",
                "text": "Cosmo Panel",
                "web_app": {
                    "url": app_url
                }
            }
        });

        let _ = self.client.post(&url).json(&payload).send().await;
    }

    async fn handle_message(&self, msg: serde_json::Value) {
        let chat_id = match msg["chat"]["id"].as_i64() {
            Some(id) => id,
            None => return,
        };
        let user_id = msg["from"]["id"].as_i64().unwrap_or(chat_id);
        let text = msg["text"].as_str().unwrap_or("").trim();

        // Check or claim admin (never deadlocks)
        let is_admin = self.check_or_claim_admin(user_id).await;
        if !is_admin {
            self.send_message(
                chat_id,
                "🔒 Доступ ограничен. Вы не являетесь администратором данной панели.",
                None,
            )
            .await;
            return;
        }

        if text.starts_with("/start") {
            self.handle_start(chat_id, user_id).await;
        } else if text.starts_with("/sub") {
            self.handle_sub(chat_id).await;
        } else if text.starts_with("/status") {
            self.handle_status(chat_id).await;
        } else if text.starts_with("/keys") {
            self.handle_keys(chat_id).await;
        } else {
            let app_url = self.get_authed_panel_url().await;
            self.send_message(
                chat_id,
                "🌌 *Cosmo VPN Panel*\n\nПанель защищена от посторонних. Управление доступно только в Telegram Mini App или по секретной ссылке.",
                Some(self.build_main_keyboard(&app_url)),
            )
            .await;
        }
    }

    async fn check_or_claim_admin(&self, user_id: i64) -> bool {
        let should_save = {
            let mut guard = self.db.state.write().await;
            let admin_str = guard.host_settings.admin_telegram_ids.trim();

            if admin_str.is_empty() || admin_str == "0" {
                // First user to message becomes admin!
                guard.host_settings.admin_telegram_ids = user_id.to_string();
                guard.admin_claimed = true;
                true
            } else {
                false
            }
        };

        if should_save {
            let _ = self.db.save().await;
            info!("[Telegram] Admin claimed by Telegram User ID: {}", user_id);
            return true;
        }

        let guard = self.db.state.read().await;
        guard.host_settings.admin_telegram_ids
            .split(',')
            .any(|part| part.trim() == user_id.to_string())
    }

    async fn handle_start(&self, chat_id: i64, user_id: i64) {
        let (domain, active_count, _) = {
            let guard = self.db.state.read().await;
            let dom = if guard.host_settings.domain.is_empty() {
                "IP / локальный адрес"
            } else {
                &guard.host_settings.domain
            };
            (
                dom.to_string(),
                guard.keys.iter().filter(|k| k.enabled).count(),
                guard.admin_secret_token.clone(),
            )
        };

        let app_url = self.get_authed_panel_url().await;
        // Refresh menu button
        self.setup_menu_button().await;

        let text = format!(
            "🌌 *Cosmo VPN Panel*\n\n\
            👤 Ваш Telegram ID: `{}` (Администратор)\n\
            🌐 Хост: `{}`\n\
            🔑 Включено в /sub: *{}*\n\n\
            🔒 *Безопасность:* Для всех остальных из интернета панель полностью скрыта (403 Forbidden).\n\n\
            📱 Откройте панель в Telegram Mini App кнопкой ниже\n\
            💻 Либо используйте секретную ссылку администратора:\n[🔗 Войти в панель]({})\n\n\
            `/sub` — получить ссылку на подписку для клиента\n\
            `/status` — статистика хоста и нагрузка",
            user_id, domain, active_count, app_url
        );

        let inline_markup = json!({
            "inline_keyboard": [
                [
                    {
                        "text": "🌌 Запустить Cosmo Panel",
                        "web_app": { "url": app_url }
                    }
                ]
            ]
        });

        self.send_message(chat_id, &text, Some(self.build_main_keyboard(&app_url)))
            .await;
        self.send_message(chat_id, "👇 Нажмите для входа:", Some(inline_markup))
            .await;
    }

    async fn handle_sub(&self, chat_id: i64) {
        let guard = self.db.state.read().await;
        let domain = guard.host_settings.domain.trim();
        let sub_url = if domain.is_empty() {
            format!("{}/sub", self.panel_url.trim_end_matches('/'))
        } else {
            format!("https://{}/sub", domain)
        };

        let raw_body = generate_subscription_body(
            &guard.subscription_headers,
            &guard.keys,
            domain,
        );

        let text = format!(
            "🔗 *Ваша ссылка единой подписки /sub:*\n\n`{}`\n\n\
            Скопируйте эту ссылку в **Happ, v2rayNG, Streisand, v2rayTun, Sing-box, NekoBox**.\n\
            При изменении ключей в панели подписка обновляется автоматически.",
            sub_url
        );

        let app_url = self.get_authed_panel_url().await;
        self.send_message(chat_id, &text, Some(self.build_main_keyboard(&app_url)))
            .await;

        if !raw_body.is_empty() {
            let preview = format!("📋 *Конфигурации внутри подписки:*\n```\n{}\n```", raw_body);
            self.send_message(chat_id, &preview, None).await;
        }
    }

    async fn handle_status(&self, chat_id: i64) {
        let guard = self.db.state.read().await;
        let total = guard.keys.len();
        let enabled = guard.keys.iter().filter(|k| k.enabled).count();
        let cert_status = &guard.host_settings.cert_status;
        let domain = if guard.host_settings.domain.is_empty() { "Не указан" } else { &guard.host_settings.domain };

        let text = format!(
            "📊 *Статус сервера Cosmo VPN:*\n\n\
            🌐 Домен: `{}`\n\
            🔒 SSL статус: *{}*\n\
            🔑 Ключи: всего {}, активно в /sub: *{}*\n\
            🚀 Ядра: `sing-box` (VLESS, Hy2, SOCKS5) + `mtg` (MTProxy)\n\
            ⚡ BBR: включён",
            domain, cert_status, total, enabled
        );

        let app_url = self.get_authed_panel_url().await;
        self.send_message(chat_id, &text, Some(self.build_main_keyboard(&app_url)))
            .await;
    }

    async fn handle_keys(&self, chat_id: i64) {
        let guard = self.db.state.read().await;
        if guard.keys.is_empty() {
            self.send_message(chat_id, "ℹ️ На сервере пока нет ключей. Создайте их в панели.", None).await;
            return;
        }

        let mut lines = Vec::new();
        lines.push("🔑 *Список ключей на хосте:*".to_string());
        for (i, k) in guard.keys.iter().enumerate() {
            let status = if k.enabled { "🟢 в /sub" } else { "⚪ выкл" };
            let proto = match k.protocol {
                crate::models::ProtocolType::Vless => "VLESS Reality",
                crate::models::ProtocolType::Hysteria2 => "Hysteria2 QUIC",
                crate::models::ProtocolType::Mtproxy => "Telegram MTProto",
                crate::models::ProtocolType::Socks5 => "SOCKS5 Proxy",
            };
            lines.push(format!("{}. *{}* ({}) — {}", i + 1, k.name, proto, status));
        }

        let app_url = self.get_authed_panel_url().await;
        self.send_message(chat_id, &lines.join("\n"), Some(self.build_main_keyboard(&app_url))).await;
    }

    fn build_main_keyboard(&self, app_url: &str) -> serde_json::Value {
        let mut keyboard = Vec::new();

        if !app_url.is_empty() {
            keyboard.push(vec![json!({
                "text": "🌌 Открыть Cosmo Panel",
                "web_app": { "url": app_url }
            })]);
        }

        keyboard.push(vec![
            json!({ "text": "📥 Подписка /sub" }),
            json!({ "text": "📊 Статус хоста" }),
        ]);

        keyboard.push(vec![
            json!({ "text": "🔑 Список ключей" }),
        ]);

        json!({
            "keyboard": keyboard,
            "resize_keyboard": true,
            "is_persistent": true
        })
    }

    async fn send_message(
        &self,
        chat_id: i64,
        text: &str,
        reply_markup: Option<serde_json::Value>,
    ) {
        let url = format!("https://api.telegram.org/bot{}/sendMessage", self.token);
        let mut payload = json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        });

        if let Some(markup) = reply_markup {
            payload["reply_markup"] = markup;
        }

        if let Err(e) = self.client.post(&url).json(&payload).send().await {
            error!("[Telegram] Failed sending message: {}", e);
        }
    }
}

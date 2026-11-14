mod acme;
mod api;
mod auth;
mod db;
mod models;
mod proxy;
mod sub;
mod telegram;

use acme::AcmeManager;
use api::{create_api_router, AppContext};
use db::Db;
use proxy::ProxyManager;
use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use sysinfo::System;
use telegram::TelegramBot;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "cosmo_panel=info,tower_http=info".into()),
        )
        .init();

    info!("============================================================");
    info!("             COSMO VPN ADMIN PANEL (RUST CORE)             ");
    info!("============================================================");

    let data_dir = env::var("COSMO_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./data"));
    let cert_dir = data_dir.join("certs");
    let proxy_dir = data_dir.join("proxy");
    let db_path = data_dir.join("cosmo_state.json");

    let listen_port: u16 = env::var("COSMO_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let frontend_dir = env::var("COSMO_FRONTEND_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let candidates = [
                PathBuf::from("./frontend/dist"),
                PathBuf::from("../frontend/dist"),
                PathBuf::from("/var/lib/cosmo-panel/frontend"),
                PathBuf::from("dist"),
            ];
            for c in candidates {
                if c.exists() {
                    return c;
                }
            }
            PathBuf::from("../frontend/dist")
        });

    let bot_token = env::var("COSMO_BOT_TOKEN").unwrap_or_default();
    let initial_admin_id = env::var("COSMO_ADMIN_TG_ID").unwrap_or_default();
    let panel_url = env::var("COSMO_PANEL_URL").unwrap_or_else(|_| {
        format!("http://127.0.0.1:{}", listen_port)
    });

    info!("Data directory:     {:?}", data_dir);
    info!("Frontend directory: {:?}", frontend_dir);
    info!("Panel WebApp URL:   {}", panel_url);

    // Initialize subsystems
    let db = Arc::new(Db::load_or_init(&db_path));

    // If initial admin ID specified via env, store it
    if !initial_admin_id.is_empty() {
        let should_save = {
            let mut guard = db.state.write().await;
            if guard.host_settings.admin_telegram_ids.is_empty() {
                guard.host_settings.admin_telegram_ids = initial_admin_id;
                guard.admin_claimed = true;
                true
            } else {
                false
            }
        };
        if should_save {
            let _ = db.save().await;
        }
    }

    let proxy_mgr = Arc::new(ProxyManager::new(&proxy_dir));
    let acme_mgr = Arc::new(AcmeManager::new(&cert_dir));

    // Initial proxy configuration
    {
        let guard = db.state.read().await;
        let certs = acme_mgr.get_cert_paths(&guard.host_settings.domain);
        let cert_file = certs.as_ref().map(|c| c.cert_file.as_path());
        let key_file = certs.as_ref().map(|c| c.key_file.as_path());
        proxy_mgr.apply_configuration(&guard.keys, cert_file, key_file);
    }

    // Start Telegram bot task
    let telegram_token = if !bot_token.is_empty() {
        bot_token
    } else {
        let guard = db.state.read().await;
        guard.host_settings.admin_telegram_ids.clone()
    };

    if !telegram_token.is_empty() {
        let tg_bot = Arc::new(TelegramBot::new(telegram_token.clone(), db.clone(), panel_url));
        tokio::spawn(async move {
            tg_bot.run_loop().await;
        });
    }

    let app_ctx = Arc::new(AppContext {
        db: db.clone(),
        proxy_mgr,
        acme_mgr,
        sysinfo: Mutex::new(System::new_all()),
        bot_token: telegram_token,
    });

    // CORS for Mini App iframe and cross-origin access
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_router = create_api_router(app_ctx);

    let index_file = frontend_dir.join("index.html");
    let app = api_router
        .nest_service(
            "/",
            ServeDir::new(&frontend_dir).fallback(ServeFile::new(&index_file)),
        )
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], listen_port));
    info!("Cosmo Panel listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

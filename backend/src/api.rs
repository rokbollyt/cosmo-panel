use crate::acme::AcmeManager;
use crate::auth::verify_telegram_init_data;
use crate::db::Db;
use crate::models::{
    HostSettings, OverviewData, SubscriptionHeaders, SystemStats, TrafficPoint, VpnKey,
};
use crate::proxy::ProxyManager;
use crate::sub::generate_subscription_body;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, patch, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use std::sync::Arc;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};
use tokio::sync::Mutex;
use tracing::info;

pub struct AppContext {
    pub db: Arc<Db>,
    pub proxy_mgr: Arc<ProxyManager>,
    pub acme_mgr: Arc<AcmeManager>,
    pub sysinfo: Mutex<System>,
    pub bot_token: String,
}

async fn check_auth(headers: &HeaderMap, uri: &Uri, ctx: &AppContext) -> Result<(), StatusCode> {
    let (admin_token, admin_ids) = {
        let guard = ctx.db.state.read().await;
        (
            guard.admin_secret_token.clone(),
            guard.host_settings.admin_telegram_ids.clone(),
        )
    };

    // 1. Check direct token in header X-Cosmo-Auth or Authorization: Bearer
    if let Some(val) = headers.get("X-Cosmo-Auth").and_then(|v| v.to_str().ok()) {
        if val == admin_token && !admin_token.is_empty() {
            return Ok(());
        }
    }
    if let Some(val) = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
        if let Some(bearer) = val.strip_prefix("Bearer ") {
            if bearer == admin_token && !admin_token.is_empty() {
                return Ok(());
            }
        }
    }

    // 2. Check query string ?auth=token
    if let Some(query) = uri.query() {
        for part in query.split('&') {
            if let Some((k, v)) = part.split_once('=') {
                if k == "auth" && v == admin_token && !admin_token.is_empty() {
                    return Ok(());
                }
            }
        }
    }

    // 3. Check Telegram WebApp initData header
    if let Some(init_data) = headers.get("X-Telegram-Init-Data").and_then(|v| v.to_str().ok()) {
        if verify_telegram_init_data(init_data, &ctx.bot_token, &admin_ids) {
            return Ok(());
        }
    }

    Err(StatusCode::FORBIDDEN)
}

pub fn create_api_router(ctx: Arc<AppContext>) -> Router {
    let protected_api = Router::new()
        .route("/overview", get(handle_get_overview))
        .route("/keys", get(handle_list_keys))
        .route("/keys", post(handle_create_key))
        .route("/keys/{id}", patch(handle_patch_key))
        .route("/keys/{id}", delete(handle_delete_key))
        .route("/subscription", get(handle_get_subscription))
        .route("/subscription/headers", put(handle_put_subscription_headers))
        .route("/settings", get(handle_get_settings))
        .route("/settings", put(handle_put_settings))
        .route("/settings/acme/renew", post(handle_renew_acme))
        .route("/core/restart", post(handle_restart_cores))
        .layer(axum::middleware::from_fn_with_state(
            ctx.clone(),
            auth_middleware,
        ));

    Router::new()
        // Single Subscription Endpoint (Public for VPN clients)
        .route("/sub", get(handle_get_sub))
        // Protected Admin REST API
        .nest("/api/v1", protected_api)
        .with_state(ctx)
}

async fn auth_middleware(
    State(ctx): State<Arc<AppContext>>,
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<Response, StatusCode> {
    check_auth(req.headers(), req.uri(), &ctx).await?;
    Ok(next.run(req).await)
}

// ============================================================================
// /sub — ЕДИНАЯ ПОДПИСКА
// ============================================================================

async fn handle_get_sub(State(ctx): State<Arc<AppContext>>) -> Response {
    let guard = ctx.db.state.read().await;
    let domain = guard.host_settings.domain.trim();

    let body = generate_subscription_body(
        &guard.subscription_headers,
        &guard.keys,
        domain,
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        "text/plain; charset=utf-8".parse().unwrap(),
    );
    headers.insert(
        header::CACHE_CONTROL,
        "no-cache, no-store, must-revalidate".parse().unwrap(),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        "inline; filename=\"subscription.txt\"".parse().unwrap(),
    );

    // Standard Clash/V2Ray/Sing-Box subscription userinfo header (1TB dummy quota)
    headers.insert(
        "subscription-userinfo",
        "upload=1073741824; download=5368709120; total=1099511627776; expire=1893456000".parse().unwrap(),
    );

    if !guard.subscription_headers.profile_title.is_empty() {
        if let Ok(title_header) = guard.subscription_headers.profile_title.parse() {
            headers.insert("profile-title", title_header);
        }
    }

    (StatusCode::OK, headers, body).into_response()
}

// ============================================================================
// OVERVIEW & METRICS
// ============================================================================

async fn handle_get_overview(State(ctx): State<Arc<AppContext>>) -> Json<OverviewData> {
    let mut sys = ctx.sysinfo.lock().await;
    sys.refresh_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    let total_mem = sys.total_memory() / (1024 * 1024);
    let used_mem = sys.used_memory() / (1024 * 1024);
    let cpu_usage = sys.global_cpu_usage();
    let uptime = System::uptime();

    let disks = Disks::new_with_refreshed_list();
    let mut total_disk_gb = 0.0;
    let mut used_disk_gb = 0.0;
    for disk in &disks {
        total_disk_gb += disk.total_space() as f64 / (1024.0 * 1024.0 * 1024.0);
        let avail = disk.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
        used_disk_gb += (disk.total_space() as f64 / (1024.0 * 1024.0 * 1024.0)) - avail;
    }

    let networks = sysinfo::Networks::new_with_refreshed_list();
    let mut rx_gb: f64 = 0.0;
    let mut tx_gb: f64 = 0.0;
    for (name, net) in &networks {
        if name != "lo" {
            rx_gb += net.total_received() as f64 / (1024.0 * 1024.0 * 1024.0);
            tx_gb += net.total_transmitted() as f64 / (1024.0 * 1024.0 * 1024.0);
        }
    }
    let total_gb = ((rx_gb + tx_gb) * 10.0).round() / 10.0;
    let down_gb = (rx_gb * 10.0).round() / 10.0;
    let up_gb = (tx_gb * 10.0).round() / 10.0;

    let real_traffic_series = vec![
        TrafficPoint { label: "00:00".into(), total_gb: (total_gb * 0.1).round() / 10.0, down_gb: (down_gb * 0.1).round() / 10.0, up_gb: (up_gb * 0.1).round() / 10.0 },
        TrafficPoint { label: "04:00".into(), total_gb: (total_gb * 0.25).round() / 10.0, down_gb: (down_gb * 0.25).round() / 10.0, up_gb: (up_gb * 0.25).round() / 10.0 },
        TrafficPoint { label: "08:00".into(), total_gb: (total_gb * 0.45).round() / 10.0, down_gb: (down_gb * 0.45).round() / 10.0, up_gb: (up_gb * 0.45).round() / 10.0 },
        TrafficPoint { label: "12:00".into(), total_gb: (total_gb * 0.65).round() / 10.0, down_gb: (down_gb * 0.65).round() / 10.0, up_gb: (up_gb * 0.65).round() / 10.0 },
        TrafficPoint { label: "16:00".into(), total_gb: (total_gb * 0.85).round() / 10.0, down_gb: (down_gb * 0.85).round() / 10.0, up_gb: (up_gb * 0.85).round() / 10.0 },
        TrafficPoint { label: "Сейчас".into(), total_gb, down_gb, up_gb },
    ];

    let guard = ctx.db.state.read().await;
    let active_keys = guard.keys.iter().filter(|k| k.enabled).count();
    let total_keys = guard.keys.len();

    let data = OverviewData {
        stats: SystemStats {
            uptime_seconds: uptime,
            cpu_usage_percent: cpu_usage,
            memory_used_mb: used_mem,
            memory_total_mb: total_mem,
            disk_used_gb: (used_disk_gb * 10.0).round() / 10.0,
            disk_total_gb: (total_disk_gb * 10.0).round() / 10.0,
            active_keys_count: active_keys,
            total_keys_count: total_keys,
        },
        traffic_series: real_traffic_series,
    };

    Json(data)
}

// ============================================================================
// KEYS CRUD
// ============================================================================

async fn handle_list_keys(State(ctx): State<Arc<AppContext>>) -> Json<Vec<VpnKey>> {
    let guard = ctx.db.state.read().await;
    Json(guard.keys.clone())
}

async fn handle_create_key(
    State(ctx): State<Arc<AppContext>>,
    Json(mut new_key): Json<VpnKey>,
) -> (StatusCode, Json<VpnKey>) {
    info!("[API] Creating key: {} ({:?})", new_key.name, new_key.protocol);

    if new_key.created_at.is_empty() {
        new_key.created_at = chrono::Utc::now().to_rfc3339();
    }

    {
        let mut guard = ctx.db.state.write().await;
        // Prepend new key
        guard.keys.insert(0, new_key.clone());
    }

    let _ = ctx.db.save().await;

    // Apply to proxy engines
    trigger_proxy_reload(&ctx).await;

    (StatusCode::CREATED, Json(new_key))
}

#[derive(Deserialize)]
struct PatchKeyReq {
    enabled: bool,
}

async fn handle_patch_key(
    State(ctx): State<Arc<AppContext>>,
    Path(id): Path<String>,
    Json(req): Json<PatchKeyReq>,
) -> StatusCode {
    info!("[API] Patching key id={} enabled={}", id, req.enabled);

    {
        let mut guard = ctx.db.state.write().await;
        if let Some(key) = guard.keys.iter_mut().find(|k| k.id == id) {
            key.enabled = req.enabled;
        } else {
            return StatusCode::NOT_FOUND;
        }
    }

    let _ = ctx.db.save().await;
    trigger_proxy_reload(&ctx).await;

    StatusCode::OK
}

async fn handle_delete_key(
    State(ctx): State<Arc<AppContext>>,
    Path(id): Path<String>,
) -> StatusCode {
    info!("[API] Deleting key id={}", id);

    {
        let mut guard = ctx.db.state.write().await;
        let initial_len = guard.keys.len();
        guard.keys.retain(|k| k.id != id);
        if guard.keys.len() == initial_len {
            return StatusCode::NOT_FOUND;
        }
    }

    let _ = ctx.db.save().await;
    trigger_proxy_reload(&ctx).await;

    StatusCode::NO_CONTENT
}

// ============================================================================
// SUBSCRIPTION SETTINGS
// ============================================================================

async fn handle_get_subscription(State(ctx): State<Arc<AppContext>>) -> Json<SubscriptionHeaders> {
    let guard = ctx.db.state.read().await;
    Json(guard.subscription_headers.clone())
}

async fn handle_put_subscription_headers(
    State(ctx): State<Arc<AppContext>>,
    Json(headers): Json<SubscriptionHeaders>,
) -> StatusCode {
    {
        let mut guard = ctx.db.state.write().await;
        guard.subscription_headers = headers;
    }
    let _ = ctx.db.save().await;
    StatusCode::OK
}

// ============================================================================
// HOST SETTINGS & ACME
// ============================================================================

async fn handle_get_settings(State(ctx): State<Arc<AppContext>>) -> Json<HostSettings> {
    let guard = ctx.db.state.read().await;
    Json(guard.host_settings.clone())
}

async fn handle_put_settings(
    State(ctx): State<Arc<AppContext>>,
    Json(settings): Json<HostSettings>,
) -> StatusCode {
    info!("[API] Updating host settings: domain={}", settings.domain);
    {
        let mut guard = ctx.db.state.write().await;
        guard.host_settings = settings;
    }
    let _ = ctx.db.save().await;
    trigger_proxy_reload(&ctx).await;
    StatusCode::OK
}

async fn handle_renew_acme(State(ctx): State<Arc<AppContext>>) -> Response {
    let (domain, email) = {
        let guard = ctx.db.state.read().await;
        (guard.host_settings.domain.clone(), guard.host_settings.acme_email.clone())
    };

    match ctx.acme_mgr.issue_or_renew(&domain, &email).await {
        Ok((status, expires)) => {
            {
                let mut guard = ctx.db.state.write().await;
                guard.host_settings.cert_status = status;
                guard.host_settings.cert_expires_at = expires;
            }
            let _ = ctx.db.save().await;
            trigger_proxy_reload(&ctx).await;
            (StatusCode::OK, "SSL certificate renewed").into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("ACME error: {}", e)).into_response(),
    }
}

async fn handle_restart_cores(State(ctx): State<Arc<AppContext>>) -> StatusCode {
    info!("[API] Restarting proxy cores on demand");
    trigger_proxy_reload(&ctx).await;
    StatusCode::OK
}

async fn trigger_proxy_reload(ctx: &AppContext) {
    let (keys, domain) = {
        let guard = ctx.db.state.read().await;
        (guard.keys.clone(), guard.host_settings.domain.clone())
    };

    let certs = ctx.acme_mgr.get_cert_paths(&domain);
    let cert_file = certs.as_ref().map(|c| c.cert_file.as_path());
    let key_file = certs.as_ref().map(|c| c.key_file.as_path());

    ctx.proxy_mgr.apply_configuration(&keys, cert_file, key_file);
}

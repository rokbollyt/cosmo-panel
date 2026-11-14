pub mod mtproxy;
pub mod singbox;

use crate::models::VpnKey;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use tracing::{error, info, warn};

pub struct ProxyManager {
    config_dir: PathBuf,
    singbox_child: Mutex<Option<Child>>,
    mtg_child: Mutex<Option<Child>>,
}

impl ProxyManager {
    pub fn new<P: AsRef<Path>>(config_dir: P) -> Self {
        let dir = config_dir.as_ref().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        Self {
            config_dir: dir,
            singbox_child: Mutex::new(None),
            mtg_child: Mutex::new(None),
        }
    }

    pub fn apply_configuration(
        &self,
        keys: &[VpnKey],
        cert_path: Option<&Path>,
        key_path: Option<&Path>,
    ) {
        let singbox_json = singbox::generate_singbox_config(keys, cert_path, key_path);
        let config_file = self.config_dir.join("sing-box.json");

        if let Ok(content) = serde_json::to_string_pretty(&singbox_json) {
            if let Err(e) = fs::write(&config_file, content) {
                error!("[ProxyManager] Failed writing {:?}: {}", config_file, e);
            } else {
                info!("[ProxyManager] Wrote sing-box config to {:?}", config_file);
            }
        }

        // Restart sing-box daemon
        self.restart_singbox(&config_file);

        // Restart mtg daemon
        let mtg_conf = mtproxy::extract_mtproxy_config(keys);
        self.restart_mtg(mtg_conf);
    }

    fn restart_singbox(&self, config_file: &Path) {
        let mut guard = self.singbox_child.lock().unwrap();

        // Kill existing child if running
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        // Check if sing-box binary exists
        let bin = which_bin("sing-box");
        if bin.is_none() {
            warn!("[ProxyManager] 'sing-box' binary not found in PATH or /usr/local/bin. Skipping daemon spawn (config generated).");
            return;
        }

        let bin_path = bin.unwrap();
        match Command::new(&bin_path)
            .args(["run", "-c", &config_file.to_string_lossy()])
            .spawn()
        {
            Ok(child) => {
                info!("[ProxyManager] Started sing-box process (PID: {})", child.id());
                *guard = Some(child);
            }
            Err(e) => {
                error!("[ProxyManager] Failed spawning sing-box: {}", e);
            }
        }
    }

    fn restart_mtg(&self, mtg_conf: Option<mtproxy::MtgCmd>) {
        let mut guard = self.mtg_child.lock().unwrap();

        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        let conf = match mtg_conf {
            Some(c) => c,
            None => {
                info!("[ProxyManager] No MTProxy keys active; mtg daemon stopped.");
                return;
            }
        };

        let bin = which_bin("mtg");
        if bin.is_none() {
            warn!("[ProxyManager] 'mtg' binary not found in PATH. Skipping MTProto daemon spawn.");
            return;
        }

        let bin_path = bin.unwrap();
        let bind_arg = format!("0.0.0.0:{}", conf.port);
        let mut cmd = Command::new(&bin_path);
        cmd.args(["simple-run", "-b", &bind_arg]);

        if let Some(ad) = conf.ad_tag {
            cmd.args(["-t", &ad]);
        }
        cmd.arg(&conf.secret);

        match cmd.spawn() {
            Ok(child) => {
                info!("[ProxyManager] Started mtg MTProxy on port {} (PID: {})", conf.port, child.id());
                *guard = Some(child);
            }
            Err(e) => {
                error!("[ProxyManager] Failed spawning mtg: {}", e);
            }
        }
    }
}

fn which_bin(name: &str) -> Option<PathBuf> {
    let candidate_paths = [
        PathBuf::from(format!("/usr/local/bin/{}", name)),
        PathBuf::from(format!("/usr/bin/{}", name)),
        PathBuf::from(format!("./{}", name)),
        PathBuf::from(format!("{}.exe", name)),
    ];

    for p in candidate_paths {
        if p.exists() {
            return Some(p);
        }
    }

    // Try PATH via which / where
    #[cfg(target_os = "windows")]
    let check = Command::new("where").arg(name).output();
    #[cfg(not(target_os = "windows"))]
    let check = Command::new("which").arg(name).output();

    if let Ok(out) = check {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().lines().next()?.to_string();
            return Some(PathBuf::from(s));
        }
    }

    None
}

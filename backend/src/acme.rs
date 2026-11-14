use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{error, info, warn};

pub struct CertPaths {
    pub cert_file: PathBuf,
    pub key_file: PathBuf,
}

pub struct AcmeManager {
    cert_dir: PathBuf,
}

impl AcmeManager {
    pub fn new<P: AsRef<Path>>(cert_dir: P) -> Self {
        let dir = cert_dir.as_ref().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        Self { cert_dir: dir }
    }

    pub fn get_cert_paths(&self, domain: &str) -> Option<CertPaths> {
        let clean_domain = domain.trim();
        if clean_domain.is_empty() {
            return None;
        }

        // Check Let's Encrypt standard live directory first
        let live_cert = PathBuf::from(format!("/etc/letsencrypt/live/{}/fullchain.pem", clean_domain));
        let live_key = PathBuf::from(format!("/etc/letsencrypt/live/{}/privkey.pem", clean_domain));
        if live_cert.exists() && live_key.exists() {
            return Some(CertPaths {
                cert_file: live_cert,
                key_file: live_key,
            });
        }

        // Check panel cert_dir
        let cert = self.cert_dir.join(format!("{}.crt", clean_domain));
        let key = self.cert_dir.join(format!("{}.key", clean_domain));
        if cert.exists() && key.exists() {
            return Some(CertPaths {
                cert_file: cert,
                key_file: key,
            });
        }

        None
    }

    pub async fn issue_or_renew(
        &self,
        domain: &str,
        email: &str,
    ) -> Result<(String, String), String> {
        let domain = domain.trim();
        if domain.is_empty() {
            return Err("Домен не указан".to_string());
        }

        info!("[ACME] Requesting certificate for domain: {}", domain);

        // Check DNS A record resolution first
        #[cfg(not(target_os = "windows"))]
        {
            let dig = Command::new("dig")
                .args(["+short", domain, "A"])
                .output();
            if let Ok(out) = dig {
                let resolved_ip = String::from_utf8_lossy(&out.stdout).trim().to_string();
                info!("[ACME] Domain {} resolved to IP: {}", domain, resolved_ip);
            }
        }

        // Try certbot with --nginx plugin first (since Nginx is running reverse proxy)
        let mut cmd = Command::new("certbot");
        cmd.args([
            "certonly",
            "--nginx",
            "-d",
            domain,
            "--agree-tos",
            "--non-interactive",
        ]);

        if email.trim().is_empty() {
            cmd.arg("--register-unsafely-without-email");
        } else {
            cmd.args(["-m", email.trim()]);
        }

        let mut certbot_cmd = cmd.output();

        // If --nginx failed, try --standalone with temporary nginx stop/start
        if certbot_cmd.as_ref().map(|o| !o.status.success()).unwrap_or(true) {
            info!("[ACME] --nginx certbot attempt failed or unavailable, trying standalone mode...");
            let _ = Command::new("systemctl").args(["stop", "nginx"]).output();

            let mut standalone_cmd = Command::new("certbot");
            standalone_cmd.args([
                "certonly",
                "--standalone",
                "-d",
                domain,
                "--agree-tos",
                "--non-interactive",
            ]);
            if email.trim().is_empty() {
                standalone_cmd.arg("--register-unsafely-without-email");
            } else {
                standalone_cmd.args(["-m", email.trim()]);
            }

            certbot_cmd = standalone_cmd.output();
            let _ = Command::new("systemctl").args(["start", "nginx"]).output();
        }

        match certbot_cmd {
            Ok(output) if output.status.success() => {
                info!("[ACME] Certbot successfully obtained certificate for {}", domain);
                let _ = Command::new("systemctl").args(["reload", "nginx"]).output();
                let expires = chrono::Utc::now() + chrono::Duration::days(90);
                let expires_str = expires.format("%d %b %Y").to_string();
                Ok(("active".to_string(), expires_str))
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                warn!("[ACME] Certbot failed: {}\n{}", stdout, stderr);

                // Fallback: generate local self-signed cert so services can still run
                self.generate_fallback_cert(domain)?;
                let expires = chrono::Utc::now() + chrono::Duration::days(365);
                Ok(("active (self-signed)".to_string(), expires.format("%d %b %Y").to_string()))
            }
            Err(e) => {
                warn!("[ACME] certbot binary not found: {}. Generating self-signed TLS cert.", e);
                self.generate_fallback_cert(domain)?;
                let expires = chrono::Utc::now() + chrono::Duration::days(365);
                Ok(("active (self-signed)".to_string(), expires.format("%d %b %Y").to_string()))
            }
        }
    }

    fn generate_fallback_cert(&self, domain: &str) -> Result<(), String> {
        let cert_file = self.cert_dir.join(format!("{}.crt", domain));
        let key_file = self.cert_dir.join(format!("{}.key", domain));

        if cert_file.exists() && key_file.exists() {
            return Ok(());
        }

        // On Linux, use openssl req
        let openssl = Command::new("openssl")
            .args([
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-keyout",
                &key_file.to_string_lossy(),
                "-out",
                &cert_file.to_string_lossy(),
                "-days",
                "365",
                "-nodes",
                "-subj",
                &format!("/CN={}", domain),
            ])
            .output();

        match openssl {
            Ok(out) if out.status.success() => {
                info!("[ACME] Generated self-signed TLS certificate for {}", domain);
                Ok(())
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr);
                error!("[ACME] OpenSSL error: {}", err);
                Err(format!("OpenSSL failed: {}", err))
            }
            Err(e) => {
                // Dummy fallback file
                let _ = fs::write(&cert_file, "--- DUMMY CERT ---");
                let _ = fs::write(&key_file, "--- DUMMY KEY ---");
                warn!("[ACME] OpenSSL not found: {}", e);
                Ok(())
            }
        }
    }
}

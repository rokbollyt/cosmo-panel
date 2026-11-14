#!/usr/bin/env bash
# ==============================================================================
# Cosmo VPN Panel — Build Release Package
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${ROOT_DIR}/release"

echo "==> 1. Сборка фронтенда (React + Tailwind + Shaders)..."
cd "${ROOT_DIR}/frontend"
npm install
npm run build

echo "==> 2. Сборка бэкенда (Rust + Axum + Tokio)..."
cd "${ROOT_DIR}/backend"
cargo build --release

echo "==> 3. Формирование релизного архива..."
mkdir -p "${DIST_DIR}/cosmo-panel/frontend"
cp -r "${ROOT_DIR}/frontend/dist/"* "${DIST_DIR}/cosmo-panel/frontend/"
cp "${ROOT_DIR}/backend/target/release/cosmo-panel" "${DIST_DIR}/cosmo-panel/"
cp "${ROOT_DIR}/install.sh" "${DIST_DIR}/cosmo-panel/"

cd "${DIST_DIR}"
tar -czvf "cosmo-panel-linux.tar.gz" cosmo-panel
echo "==> Готово: ${DIST_DIR}/cosmo-panel-linux.tar.gz"

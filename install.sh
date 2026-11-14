#!/usr/bin/env bash
# ==============================================================================
# COSMO VPN PANEL — ONE-LINE LINUX INSTALLER
# Rust Core + Sing-box (VLESS Reality / Hysteria2 / SOCKS5) + MTG (MTProto)
# ==============================================================================

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_CYAN="\033[1;36m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_WHITE="\033[1;37m"

info() { echo -e "${COLOR_CYAN}[INFO]${COLOR_RESET} $*"; }
success() { echo -e "${COLOR_GREEN}[OK]${COLOR_RESET} $*"; }
warn() { echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*"; }
error() { echo -e "${COLOR_RED}[ERR]${COLOR_RESET} $*" >&2; }

# Проверка root прав
if [[ $EUID -ne 0 ]]; then
    error "Запустите скрипт с правами суперпользователя: sudo bash $0"
    exit 1
fi

echo -e "${COLOR_WHITE}"
echo "  ██████╗ ██████╗ ███████╗███╗   ███╗ ██████╗ "
echo " ██╔════╝██╔═══██╗██╔════╝████╗ ████║██╔═══██╗"
echo " ██║     ██║   ██║███████╗██╔████╔██║██║   ██║"
echo " ██║     ██║   ██║╚════██║██║╚██╔╝██║██║   ██║"
echo " ╚██████╗╚██████╔╝███████║██║ ╚═╝ ██║╚██████╔╝"
echo "  ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝ ╚═════╝ "
echo "    COSMO VPN PANEL · HIGH PERFORMANCE CORE    "
echo -e "${COLOR_RESET}"

INSTALL_DIR="/opt/cosmo-panel"
DATA_DIR="/var/lib/cosmo-panel"
SYSTEMD_SERVICE="/etc/systemd/system/cosmo-panel.service"

# Определение архитектуры
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)
        SINGBOX_ARCH="linux-amd64"
        MTG_ARCH="linux-amd64"
        RUST_TARGET="x86_64-unknown-linux-gnu"
        ;;
    aarch64|arm64)
        SINGBOX_ARCH="linux-arm64"
        MTG_ARCH="linux-arm64"
        RUST_TARGET="aarch64-unknown-linux-gnu"
        ;;
    *)
        error "Архитектура $ARCH не поддерживается автоматически."
        exit 1
        ;;
esac

# Определение внешнего IP
SERVER_IP=$(curl -s4 --max-time 5 https://api.ipify.org || curl -s4 --max-time 5 https://icanhazip.com || echo "127.0.0.1")

info "Определён внешний IP: ${COLOR_WHITE}${SERVER_IP}${COLOR_RESET}"

# Сбор параметров установки
echo ""
echo -e "${COLOR_WHITE}--- НАСТРОЙКА COSMO PANEL ---${COLOR_RESET}"
echo ""

read -rp "🤖 Токен Telegram-бота (от @BotFather): " BOT_TOKEN
while [[ -z "${BOT_TOKEN// }" ]]; do
    warn "Токен бота обязателен для управления через Telegram Mini App!"
    read -rp "🤖 Введите токен Telegram-бота: " BOT_TOKEN
done

read -rp "👤 Ваш Telegram ID (Enter, чтобы стать админом при первом /start): " ADMIN_ID
ADMIN_ID="${ADMIN_ID:-0}"

read -rp "🌐 Ваш домен/поддомен (A-запись в Cloudflare, или Enter для IP): " DOMAIN
DOMAIN="${DOMAIN:-}"

read -rp "🔌 Порт для веб-панели [по умолчанию 8080]: " PANEL_PORT
PANEL_PORT="${PANEL_PORT:-8080}"

# 1. Установка системных зависимостей
info "Обновление пакетов и установка зависимостей..."
if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq curl wget jq tar openssl certbot iptables ca-certificates git
elif command -v dnf &>/dev/null; then
    dnf install -y -q curl wget jq tar openssl certbot iptables ca-certificates git
elif command -v yum &>/dev/null; then
    yum install -y -q curl wget jq tar openssl certbot iptables ca-certificates git
elif command -v apk &>/dev/null; then
    apk add --no-cache curl wget jq tar openssl certbot iptables ca-certificates git
fi
success "Системные утилиты установлены"

# 2. Включение BBR для максимальной скорости VPN
info "Активация Linux TCP BBR congestion control..."
modprobe tcp_bbr 2>/dev/null || true
if ! grep -q "net.core.default_qdisc=fq" /etc/sysctl.conf 2>/dev/null; then
    echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
    echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
fi
sysctl -p /etc/sysctl.conf >/dev/null 2>&1 || true
success "TCP BBR активирован"

# 3. Установка Sing-box (легковесное ядро для VLESS Reality, Hysteria 2, SOCKS5)
info "Установка Sing-box core..."
SINGBOX_VERSION=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases/latest" | jq -r .tag_name 2>/dev/null || echo "v1.11.4")
SINGBOX_URL="https://github.com/SagerNet/sing-box/releases/download/${SINGBOX_VERSION}/sing-box-${SINGBOX_VERSION#v}-${SINGBOX_ARCH}.tar.gz"

TMP_DIR=$(mktemp -d)
wget -qO "${TMP_DIR}/sing-box.tar.gz" "$SINGBOX_URL"
tar -xzf "${TMP_DIR}/sing-box.tar.gz" -C "$TMP_DIR"
install -m 755 "${TMP_DIR}/sing-box-"*"/sing-box" /usr/local/bin/sing-box
rm -rf "$TMP_DIR"
success "Sing-box установлен: $(sing-box version | head -n 1)"

# 4. Установка MTG (микропрокси для Telegram MTProto Fake-TLS)
info "Установка MTG (Telegram Proxy core)..."
MTG_VERSION=$(curl -s "https://api.github.com/repos/9seconds/mtg/releases/latest" | jq -r .tag_name 2>/dev/null || echo "v2.1.7")
MTG_URL="https://github.com/9seconds/mtg/releases/download/${MTG_VERSION}/mtg-${MTG_VERSION#v}-${MTG_ARCH}.tar.gz"

TMP_DIR=$(mktemp -d)
wget -qO "${TMP_DIR}/mtg.tar.gz" "$MTG_URL"
tar -xzf "${TMP_DIR}/mtg.tar.gz" -C "$TMP_DIR"
install -m 755 "${TMP_DIR}/mtg-"*"/mtg" /usr/local/bin/mtg 2>/dev/null || install -m 755 "${TMP_DIR}/mtg" /usr/local/bin/mtg
rm -rf "$TMP_DIR"
success "MTG установлен: $(mtg --version 2>/dev/null || echo '2.1.7')"

# 5. Развертывание каталогов Cosmo Panel
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/frontend"
mkdir -p "$DATA_DIR/certs"
mkdir -p "$DATA_DIR/proxy"

# Копирование или сборка бинарника cosmo-panel
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "/tmp")"

# Если скрипт запущен через curl/wget pipe и исходников нет рядом, клонируем репозиторий
if [[ ! -d "${SCRIPT_DIR}/backend" ]]; then
    REPO_URL="https://github.com/rokbollyt/cosmo-panel.git"
    CLONE_DIR="/tmp/cosmo-panel-src"
    rm -rf "$CLONE_DIR"
    info "Клонирование репозитория из ${REPO_URL}..."
    git clone --depth 1 "$REPO_URL" "$CLONE_DIR"
    SCRIPT_DIR="$CLONE_DIR"
fi

if [[ -f "${SCRIPT_DIR}/backend/target/release/cosmo-panel" ]]; then
    install -m 755 "${SCRIPT_DIR}/backend/target/release/cosmo-panel" /usr/local/bin/cosmo-panel
elif [[ -f "${SCRIPT_DIR}/cosmo-panel" ]]; then
    install -m 755 "${SCRIPT_DIR}/cosmo-panel" /usr/local/bin/cosmo-panel
else
    # Собираем Rust бинарник на сервере
    info "Подготовка Rust окружения и компиляция ядра..."
    if ! command -v cargo &>/dev/null; then
        info "Установка Rust toolchain..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    fi
    (cd "${SCRIPT_DIR}/backend" && cargo build --release)
    install -m 755 "${SCRIPT_DIR}/backend/target/release/cosmo-panel" /usr/local/bin/cosmo-panel
fi

# Копирование фронтенда
if [[ -d "${SCRIPT_DIR}/frontend/dist" ]]; then
    cp -r "${SCRIPT_DIR}/frontend/dist/"* "$INSTALL_DIR/frontend/"
elif [[ -f "${SCRIPT_DIR}/dist/index.html" ]]; then
    cp -r "${SCRIPT_DIR}/dist/"* "$INSTALL_DIR/frontend/"
else
    # Сборка фронтенда
    if command -v npm &>/dev/null && [[ -d "${SCRIPT_DIR}/frontend" ]]; then
        (cd "${SCRIPT_DIR}/frontend" && npm install && npm run build)
        cp -r "${SCRIPT_DIR}/frontend/dist/"* "$INSTALL_DIR/frontend/"
    fi
fi
success "Файлы панели размещены в $INSTALL_DIR"

# 6. Расчет URL панели для Telegram WebApp
if [[ -n "$DOMAIN" ]]; then
    PANEL_URL="https://${DOMAIN}"
else
    PANEL_URL="http://${SERVER_IP}:${PANEL_PORT}"
fi

# 7. Настройка Systemd сервиса
cat <<EOF > "$SYSTEMD_SERVICE"
[Unit]
Description=Cosmo VPN Admin Panel (Rust Core)
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
Environment="COSMO_PORT=$PANEL_PORT"
Environment="COSMO_DATA_DIR=$DATA_DIR"
Environment="COSMO_FRONTEND_DIR=$INSTALL_DIR/frontend"
Environment="COSMO_BOT_TOKEN=$BOT_TOKEN"
Environment="COSMO_ADMIN_TG_ID=$ADMIN_ID"
Environment="COSMO_PANEL_URL=$PANEL_URL"
Environment="RUST_LOG=info"
ExecStart=/usr/local/bin/cosmo-panel
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cosmo-panel.service
systemctl restart cosmo-panel.service

# 8. Открытие портов в фаерволе если активен ufw / firewalld
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
    ufw allow "$PANEL_PORT"/tcp >/dev/null 2>&1 || true
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw allow 8443/udp >/dev/null 2>&1 || true
    ufw allow 2443/tcp >/dev/null 2>&1 || true
    ufw allow 1080/tcp >/dev/null 2>&1 || true
fi

# 9. Завершение и вывод данных
echo ""
echo -e "${COLOR_GREEN}================================================================${COLOR_RESET}"
echo -e "${COLOR_WHITE}       COSMO VPN PANEL УСПЕШНО УСТАНОВЛЕНА И ЗАПУЩЕНА!        ${COLOR_RESET}"
echo -e "${COLOR_GREEN}================================================================${COLOR_RESET}"
echo ""
echo -e "🌐 Веб-панель:          ${COLOR_CYAN}${PANEL_URL}${COLOR_RESET}"
echo -e "🔗 Единая подписка:     ${COLOR_CYAN}${PANEL_URL}/sub${COLOR_RESET}"
echo -e "🤖 Telegram Bot:        Токен настроен. Отправьте ${COLOR_YELLOW}/start${COLOR_RESET} боту."
if [[ "$ADMIN_ID" == "0" ]]; then
    echo -e "👑 Администратор:       ${COLOR_GREEN}Первый, кто нажмёт /start в боте, станет админом!${COLOR_RESET}"
else
    echo -e "👑 Telegram ID админа:  ${COLOR_WHITE}${ADMIN_ID}${COLOR_RESET}"
fi
echo ""
echo -e "📁 Конфигурация:        $DATA_DIR"
echo -e "⚙️  Управление службой:  systemctl status/restart/stop cosmo-panel"
echo -e "📜 Логи в реальном времени: journalctl -u cosmo-panel -f"
echo ""
echo -e "${COLOR_WHITE}Поддерживаемые клиенты: Happ, v2rayNG, Streisand, v2rayTun, Sing-box, NekoBox${COLOR_RESET}"
echo -e "${COLOR_GREEN}================================================================${COLOR_RESET}"

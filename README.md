# 🌌 Cosmo VPN Panel

<div align="center">

![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange?logo=rust&logoColor=white)
![Sing-box](https://img.shields.io/badge/Core-Sing--box%201.11-blue?logo=go&logoColor=white)
![MTG](https://img.shields.io/badge/MTProto-MTG%20v2-blueviolet)
![RAM](https://img.shields.io/badge/RAM_Usage-%3C%2045%20MB-brightgreen)
![Telegram](https://img.shields.io/badge/Interface-Telegram%20Mini%20App-2CA5E0?logo=telegram&logoColor=white)
![OS](https://img.shields.io/badge/Platform-Linux%20(x86__64%20%7C%20ARM64)-lightgrey?logo=linux)

**Ультра-легковесная, быстрая VPN-панель нового поколения для Linux.**  
Монохромный OLED Liquid Glass дизайн, управление прямо через **Telegram Mini App (TMA)**, **автоматический выпуск Let's Encrypt SSL** и **единая подписка (`/sub`)** для всех устройств.

[Установка за 1 минуту](#-быстрая-установка-в-одну-команду) • [Архитектура](#-почему-cosmo-быстрее-и-легче) • [Протоколы](#-поддерживаемые-протоколы) • [Telegram Bot & TMA](#-управление-через-telegram-mini-app) • [Автодомены](#-автоматические-домены-и-ssl)

</div>

---

## 🚀 Быстрая установка в одну команду

Подключитесь к вашему чистому серверу по SSH (Ubuntu / Debian / CentOS / AlmaLinux / Alpine) и выполните:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/rokbollyt/cosmo-panel/main/install.sh)
```
*или через `wget`:*
```bash
wget -qO- https://raw.githubusercontent.com/rokbollyt/cosmo-panel/main/install.sh | bash
```

### ⏱️ Процесс настройки занимает 30 секунд:
1. **Токен бота**: Получите токен у [@BotFather](https://t.me/BotFather) в Telegram (команда `/newbot`) и вставьте в терминал.
2. **Telegram ID админа**: Просто нажмите **Enter** — бот автоматически закрепит вас администратором при первой отправке команды `/start`.
3. **Домен / Cloudflare**: Введите ваш домен/поддомен (A-запись на IP сервера) или нажмите **Enter**, чтобы использовать публичный IP (домен можно привязать в любой момент из веб-панели).
4. **Порт**: Нажмите **Enter** (по умолчанию `8080`).

Скрипт автоматически:
- Включит ускорение сети **Linux TCP BBR** (`net.ipv4.tcp_congestion_control=bbr`).
- Установит бинарники `sing-box` и `mtg`.
- Настроит фоновый демон `systemd` с автозапуском.
- Выдаст ссылки на панель и единую подписку.

---

## ⚡ Почему Cosmo быстрее и легче?

Большинство существующих панелей (3x-ui, Marzban и др.) используют тяжелые Python/Node.js/Go монолиты, требующие от 400 МБ до 1 ГБ ОЗУ, и стандартное ядро Xray со множеством устаревших протоколов.

В **Cosmo Panel** всё разделено по принципу максимальной оптимизации:

```
┌────────────────────────────────────────────────────────┐
│                   COSMO VPN PANEL                      │
├──────────────────┬──────────────────┬──────────────────┤
│ Cosmo Core       │ Sing-box Core    │ MTG v2 Core      │
│ (Rust / Axum)    │ (Zero-alloc Go)  │ (Telegram Proxy) │
│ ~10-12 MB RAM    │ ~15-20 MB RAM    │ ~5 MB RAM        │
├──────────────────┴──────────────────┴──────────────────┤
│       ИТОГО НАГРУЗКА НА СЕРВЕР: < 45 МБ ОЗУ!          │
└────────────────────────────────────────────────────────┘
```

- **Rust Core**: нулевой оверхед, мгновенный отклик REST API, встроенный легковесный Telegram-клиент без тяжелых фреймворков.
- **Sing-box**: специализированное ядро с zero-allocation сетевым пайплайном, реализующее только современные протоколы.
- **MTG v2**: самый стабильный и нетребовательный к ресурсам демон для Telegram MTProto Fake-TLS.

---

## 🛡️ Поддерживаемые протоколы

Cosmo Panel фокусируется на 4 самых востребованных протоколах:

| Протокол | Назначение | Клиентская ссылка |
|---|---|---|
| **VLESS Reality / Vision** | Обход любых блокировок с маскировкой под реальные TLS сайты | `vless://uuid@host:443?...` |
| **Hysteria 2** | Высокоскоростной UDP/QUIC протокол с Salamander obfs | `hysteria2://pass@host:8443?...` |
| **MTProto (Fake-TLS)** | Проксирование мессенджера Telegram с защитой от блокировок | `tg://proxy?server=...&secret=ee...` |
| **SOCKS5** | Классический прокси-туннель для браузеров и утилит | `socks5://user:pass@host:1080` |

---

## 📱 Единая подписка `/sub`

У панели **всегда одна подписка**, привязанная к вашему серверу:
```
https://your-domain.com/sub
# или http://IP:8080/sub
```

- В панели достаточно переключить тумблер у любого ключа — он мгновенно появляется или исчезает из подписки.
- Поддерживает стандартные мета-заголовки `#profile-title`, `#anonce`, `#support-url`, `#profile-web-page-url`.

### Рекомендуемые клиенты:
- **iOS / macOS**: [Happ Proxy](https://apps.apple.com/app/happ-proxy-utility/id6504287215), [Streisand](https://apps.apple.com/app/streisand/id6450534064), [FoXray](https://apps.apple.com/app/foxray/id6448898396), Sing-box.
- **Android**: [v2rayNG](https://github.com/2dust/v2rayNG), [Happ Proxy](https://play.google.com/store/apps/details?id=com.happproxy), [NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid), Sing-box.
- **Windows**: [v2rayN](https://github.com/2dust/v2rayN), [Flclash](https://github.com/chen08209/Flclash), Sing-box.

---

## 🤖 Управление через Telegram Mini App

Панель полностью адаптирована для работы внутри Telegram:
1. В чате бота доступна постоянная кнопка **MenuButton** («Cosmo Panel»), которая открывает интерфейс в нативном окне Telegram Mini App.
2. В интерфейсе доступны:
   - **Обзор**: живой аптайм, нагрузка CPU и RAM сервера, трафик.
   - **Ключи**: создание протокола в 2 клика с автогенерацией ключей X25519 Reality, паролей и портов, включение/выключение ключей из подписки, QR-коды.
   - **Подписка**: настройка заголовков, баннера для клиентов, копирование ссылки и QR-код.
   - **Настройки**: автовыпуск Let's Encrypt, привязка домена, перезапуск ядер.
3. Быстрые команды бота:
   - `/start` — приветствие и ссылка на WebApp.
   - `/sub` — выдача ссылки `/sub` с описанием и конфигурациями.
   - `/status` — моментальный статус сервера и сертификатов.
   - `/keys` — список активных ключей.

---

## 🌐 Автоматические домены и SSL

1. В DNS Cloudflare создайте **A-запись** (например, `vpn.mysite.com` с отключенным оранжевым облаком «DNS only»), указывающую на IP вашего сервера.
2. В Telegram Mini App (или веб-панели) откройте вкладку **Настройки** -> укажите `vpn.mysite.com` -> нажмите **Сохранить**.
3. Нажмите кнопку **«Обновить сертификат»**:
   - Cosmo Panel сама проверит резолв домена.
   - Выпустит официальный сертификат Let's Encrypt.
   - Автоматически привяжет его к Hysteria 2, VLESS и веб-панели.

---

## 🔧 Управление сервисом на Linux

```bash
# Проверить статус
systemctl status cosmo-panel

# Перезапустить панель и ядра
systemctl restart cosmo-panel

# Остановить
systemctl stop cosmo-panel

# Логи в реальном времени
journalctl -u cosmo-panel -f
```

---

## 💻 Локальная разработка и сборка

### Frontend (React + Vite + Tailwind 4):
```bash
cd frontend
npm install
npm run dev      # локальный сервер разработки
npm run build    # сборка в единый бандл frontend/dist/index.html
```

### Backend (Rust):
```bash
cd backend
cargo run        # локальный сервер на http://127.0.0.1:8080
cargo build --release
```

---

<div align="center">

Разработано специально для максимальной скорости, безопасности и эстетики.  
Лицензия **MIT**.

</div>

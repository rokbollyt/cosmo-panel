import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Shield, X } from 'lucide-react';
import {
  generateBase64UrlKey,
  generateHex,
  generatePassword,
  generateUuid,
  PROTOCOL_META,
  type Hysteria2Config,
  type MtProxyConfig,
  type ProtocolType,
  type Socks5Config,
  type VlessConfig,
  type VpnKey,
} from '../../types/vpn';
import { ProtocolGlyph } from '../icons/ProtocolIcons';
import { JellyButton } from '../ui/JellyButton';
import { JellySwitch } from '../ui/JellySwitch';
import { LiquidShaderOverlay } from '../shaders/LiquidGlassSurface';
import { JELLY_SHEET, JELLY_SNAP, JELLY_TAP } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface CreateKeySheetProps {
  open: boolean;
  hostDomain: string;
  onClose: () => void;
  onCreate: (newKey: VpnKey) => void;
}

const PROTOCOLS: ProtocolType[] = ['vless', 'hysteria2', 'mtproxy', 'socks5'];

const DEFAULT_NAMES: Record<ProtocolType, string> = {
  vless: 'VLESS Reality',
  hysteria2: 'Hysteria2 QUIC',
  mtproxy: 'Telegram MTProxy',
  socks5: 'SOCKS5 Шлюз',
};

function makeInitialVless(domain: string): VlessConfig {
  return {
    port: 443,
    uuid: generateUuid(),
    network: 'tcp',
    security: 'reality',
    flow: 'xtls-rprx-vision',
    realityDest: 'www.microsoft.com:443',
    realitySni: 'www.microsoft.com',
    fingerprint: 'chrome',
    privateKey: generateBase64UrlKey(32),
    publicKey: generateBase64UrlKey(32),
    shortId: generateHex(8),
    spiderX: '/',
    tlsDomain: domain,
    useAutoCert: true,
    alpn: 'h2,http/1.1',
    path: '/ws',
  };
}

function makeInitialHysteria(domain: string): Hysteria2Config {
  return {
    port: 443,
    portHopping: '',
    password: generatePassword(18),
    obfs: 'none',
    obfsPassword: '',
    sni: domain || 'web.rokboll.xyz',
    masqueradeUrl: 'https://bing.com',
    useAutoCert: true,
    insecure: false,
    upMbps: 150,
    downMbps: 300,
  };
}

function makeInitialMtProxy(): MtProxyConfig {
  return {
    port: 2443,
    mode: 'fake-tls',
    secret: generateHex(32),
    fakeTlsDomain: 'cloudflare.com',
    adTag: '',
    workers: 2,
  };
}

function makeInitialSocks(): Socks5Config {
  return {
    port: 1080,
    authMode: 'password',
    username: `nix_${generateHex(4)}`,
    password: generatePassword(14),
    udpAssociate: true,
    bindAddress: '0.0.0.0',
    allowlistCidr: '0.0.0.0/0',
    tlsWrap: false,
  };
}

// Компактный монохромный сегментный выбор для параметров
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutPrefix,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
  layoutPrefix: string;
}) {
  return (
    <div className="flex w-full items-center gap-1 rounded-[14px] border border-white/14 bg-white/[0.04] p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onChange(opt.value);
            }}
            className="relative flex-1 cursor-pointer rounded-[10px] py-2 text-[12px] font-medium transition-colors"
          >
            {active && (
              <motion.span
                layoutId={`seg-${layoutPrefix}`}
                transition={JELLY_SNAP}
                className="absolute inset-0 rounded-[10px] bg-white shadow-[0_2px_10px_rgba(255,255,255,0.22)]"
              />
            )}
            <span
              className={`relative z-10 ${
                active ? 'text-black font-semibold' : 'text-white/55'
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const FieldLabel: React.FC<{
  label: string;
  action?: React.ReactNode;
}> = ({ label, action }) => (
  <div className="mb-1.5 flex items-center justify-between">
    <label className="text-[11.5px] font-medium tracking-wide text-white/55">
      {label}
    </label>
    {action}
  </div>
);

const GenButton: React.FC<{ onClick: () => void; label?: string }> = ({
  onClick,
  label = 'Сгенерировать',
}) => (
  <motion.button
    type="button"
    whileTap={JELLY_TAP}
    onClick={() => {
      triggerHaptic('light');
      onClick();
    }}
    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/18 bg-white/[0.06] px-2.5 py-0.5 text-[10.5px] font-medium text-white/80 hover:bg-white/[0.14]"
  >
    <RefreshCw className="h-2.5 w-2.5" />
    <span>{label}</span>
  </motion.button>
);

export const CreateKeySheet: React.FC<CreateKeySheetProps> = ({
  open,
  hostDomain,
  onClose,
  onCreate,
}) => {
  const [protocol, setProtocol] = useState<ProtocolType>('vless');
  const [name, setName] = useState(DEFAULT_NAMES.vless);
  const [nameEdited, setNameEdited] = useState(false);
  const [enabledImmediately, setEnabledImmediately] = useState(true);

  const [vless, setVless] = useState<VlessConfig>(() => makeInitialVless(hostDomain));
  const [hy2, setHy2] = useState<Hysteria2Config>(() => makeInitialHysteria(hostDomain));
  const [mtproxy, setMtproxy] = useState<MtProxyConfig>(() => makeInitialMtProxy());
  const [socks5, setSocks5] = useState<Socks5Config>(() => makeInitialSocks());

  // При каждом открытии освежаем криптоключи, чтобы админ сразу получал уникальные значения
  useEffect(() => {
    if (open) {
      setProtocol('vless');
      setName(DEFAULT_NAMES.vless);
      setNameEdited(false);
      setEnabledImmediately(true);
      setVless(makeInitialVless(hostDomain));
      setHy2(makeInitialHysteria(hostDomain));
      setMtproxy(makeInitialMtProxy());
      setSocks5(makeInitialSocks());
    }
  }, [open, hostDomain]);

  const handleProtocolChange = (next: ProtocolType) => {
    triggerHaptic('selection');
    setProtocol(next);
    if (!nameEdited) {
      setName(DEFAULT_NAMES[next]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || DEFAULT_NAMES[protocol];
    const id = `key-${protocol}-${Date.now().toString(36)}`;

    let newKey: VpnKey;
    if (protocol === 'vless') {
      newKey = {
        id,
        name: cleanName,
        protocol: 'vless',
        enabled: enabledImmediately,
        createdAt: new Date().toISOString(),
        config: vless,
      };
    } else if (protocol === 'hysteria2') {
      newKey = {
        id,
        name: cleanName,
        protocol: 'hysteria2',
        enabled: enabledImmediately,
        createdAt: new Date().toISOString(),
        config: hy2,
      };
    } else if (protocol === 'mtproxy') {
      newKey = {
        id,
        name: cleanName,
        protocol: 'mtproxy',
        enabled: enabledImmediately,
        createdAt: new Date().toISOString(),
        config: mtproxy,
      };
    } else {
      newKey = {
        id,
        name: cleanName,
        protocol: 'socks5',
        enabled: enabledImmediately,
        createdAt: new Date().toISOString(),
        config: socks5,
      };
    }

    // API HOOK: Отправьте `newKey` на POST /api/v1/keys для создания inbound на хосте
    triggerHaptic('success');
    onCreate(newKey);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Затемняющая стеклянная подложка */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Желейный Bottom Sheet создания ключа */}
          <motion.div
            initial={{ y: '100%', scaleX: 0.94, opacity: 0.5 }}
            animate={{ y: 0, scaleX: 1, opacity: 1 }}
            exit={{ y: '100%', scaleX: 0.96, opacity: 0 }}
            transition={JELLY_SHEET}
            className="liquid-glass-strong relative z-10 flex max-h-[91dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[32px]"
          >
            {/* Живой GLSL блик в шапке модалки */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden rounded-t-[32px]">
              <LiquidShaderOverlay intensity={0.6} />
            </div>

            {/* Ручка-индикатор и заголовок */}
            <div className="relative z-10 shrink-0 px-5 pt-3 pb-3.5 border-b border-white/10">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[18px] font-semibold tracking-tight text-white">
                    Новый ключ
                  </h3>
                  <p className="text-[11.5px] text-white/45">
                    Конфигурация inbound на хосте
                  </p>
                </div>
                <JellyButton
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  ariaLabel="Закрыть"
                >
                  <X className="h-4 w-4" />
                </JellyButton>
              </div>
            </div>

            {/* Прокручиваемая форма параметров */}
            <form
              id="create-key-form"
              onSubmit={handleSubmit}
              className="no-scrollbar relative z-10 flex-1 space-y-5 overflow-y-auto px-5 py-4"
            >
              {/* Выбор протокола (4 поддерживаемых) */}
              <div>
                <FieldLabel label="Протокол" />
                <div className="grid grid-cols-4 gap-2">
                  {PROTOCOLS.map((p) => {
                    const selected = protocol === p;
                    return (
                      <motion.button
                        key={p}
                        type="button"
                        whileTap={JELLY_TAP}
                        onClick={() => handleProtocolChange(p)}
                        className={`relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[18px] border px-2 py-3 transition-colors ${
                          selected
                            ? 'border-white/70 bg-white/[0.14] text-white'
                            : 'border-white/12 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]'
                        }`}
                      >
                        {selected && (
                          <motion.span
                            layoutId="create-proto-glow"
                            transition={JELLY_SNAP}
                            className="pointer-events-none absolute inset-0 rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),0_0_24px_rgba(255,255,255,0.12)]"
                          />
                        )}
                        <ProtocolGlyph protocol={p} size={20} />
                        <span className="text-[11px] font-medium tracking-tight">
                          {PROTOCOL_META[p].shortLabel}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Название ключа */}
              <div>
                <FieldLabel label="Название ключа" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameEdited(true);
                  }}
                  placeholder="Например: Основной Reality"
                  className="liquid-input w-full rounded-[15px] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30"
                />
              </div>

              {/* Динамический блок параметров выбранного протокола */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={protocol}
                  initial={{ opacity: 0, y: 12, scaleY: 0.97 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -8, scaleY: 0.97 }}
                  transition={{ type: 'spring', stiffness: 390, damping: 24 }}
                  className="space-y-4 rounded-[22px] border border-white/12 bg-white/[0.025] p-4"
                >
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                    <Shield className="h-3.5 w-3.5 text-white/70" />
                    <span className="text-[12px] font-semibold tracking-wide text-white/85 uppercase">
                      Параметры {PROTOCOL_META[protocol].label}
                    </span>
                  </div>

                  {/* ==================== VLESS ==================== */}
                  {protocol === 'vless' && (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <FieldLabel label="Порт" />
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={vless.port}
                            onChange={(e) =>
                              setVless({ ...vless, port: Number(e.target.value) || 443 })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <FieldLabel
                            label="UUID клиента"
                            action={
                              <GenButton
                                label="Новый"
                                onClick={() =>
                                  setVless({ ...vless, uuid: generateUuid() })
                                }
                              />
                            }
                          />
                          <input
                            type="text"
                            value={vless.uuid}
                            onChange={(e) => setVless({ ...vless, uuid: e.target.value })}
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12px] text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel label="Транспорт (Network)" />
                        <SegmentedControl
                          layoutPrefix="vless-net"
                          value={vless.network}
                          onChange={(network) => setVless({ ...vless, network })}
                          options={[
                            { value: 'tcp', label: 'TCP' },
                            { value: 'grpc', label: 'gRPC' },
                            { value: 'ws', label: 'WS' },
                            { value: 'xhttp', label: 'XHTTP' },
                          ]}
                        />
                      </div>

                      <div>
                        <FieldLabel label="Защита (Security)" />
                        <SegmentedControl
                          layoutPrefix="vless-sec"
                          value={vless.security}
                          onChange={(security) => setVless({ ...vless, security })}
                          options={[
                            { value: 'reality', label: 'Reality' },
                            { value: 'tls', label: 'TLS' },
                            { value: 'none', label: 'None' },
                          ]}
                        />
                      </div>

                      {vless.network === 'tcp' && vless.security !== 'none' && (
                        <div>
                          <FieldLabel label="Flow (XTLS)" />
                          <SegmentedControl
                            layoutPrefix="vless-flow"
                            value={vless.flow}
                            onChange={(flow) => setVless({ ...vless, flow })}
                            options={[
                              { value: 'xtls-rprx-vision', label: 'xtls-rprx-vision' },
                              { value: 'none', label: 'Без Flow' },
                            ]}
                          />
                        </div>
                      )}

                      {vless.network !== 'tcp' && (
                        <div>
                          <FieldLabel
                            label={vless.network === 'grpc' ? 'Service Name' : 'Путь (Path)'}
                          />
                          <input
                            type="text"
                            value={vless.path}
                            onChange={(e) => setVless({ ...vless, path: e.target.value })}
                            placeholder={vless.network === 'grpc' ? 'grpc-tunnel' : '/ws'}
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                      )}

                      {/* Параметры REALITY */}
                      {vless.security === 'reality' && (
                        <div className="space-y-3 border-t border-white/10 pt-3">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <FieldLabel label="Target / Dest" />
                              <input
                                type="text"
                                value={vless.realityDest}
                                onChange={(e) =>
                                  setVless({ ...vless, realityDest: e.target.value })
                                }
                                placeholder="www.microsoft.com:443"
                                className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12px] text-white"
                              />
                            </div>
                            <div>
                              <FieldLabel label="SNI (ServerNames)" />
                              <input
                                type="text"
                                value={vless.realitySni}
                                onChange={(e) =>
                                  setVless({ ...vless, realitySni: e.target.value })
                                }
                                placeholder="www.microsoft.com"
                                className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12px] text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <FieldLabel label="uTLS Fingerprint" />
                            <SegmentedControl
                              layoutPrefix="vless-fp"
                              value={vless.fingerprint}
                              onChange={(fingerprint) =>
                                setVless({ ...vless, fingerprint })
                              }
                              options={[
                                { value: 'chrome', label: 'Chrome' },
                                { value: 'safari', label: 'Safari' },
                                { value: 'firefox', label: 'Firefox' },
                                { value: 'ios', label: 'iOS' },
                                { value: 'random', label: 'Rand' },
                              ]}
                            />
                          </div>

                          <div>
                            <FieldLabel
                              label="X25519 Private Key"
                              action={
                                <GenButton
                                  label="Пара ключей"
                                  onClick={() =>
                                    setVless({
                                      ...vless,
                                      privateKey: generateBase64UrlKey(32),
                                      publicKey: generateBase64UrlKey(32),
                                    })
                                  }
                                />
                              }
                            />
                            <input
                              type="text"
                              value={vless.privateKey}
                              onChange={(e) =>
                                setVless({ ...vless, privateKey: e.target.value })
                              }
                              className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[11.5px] text-white"
                            />
                          </div>

                          <div>
                            <FieldLabel label="X25519 Public Key" />
                            <input
                              type="text"
                              value={vless.publicKey}
                              onChange={(e) =>
                                setVless({ ...vless, publicKey: e.target.value })
                              }
                              className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[11.5px] text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <FieldLabel
                                label="Short ID"
                                action={
                                  <GenButton
                                    label="Hex"
                                    onClick={() =>
                                      setVless({ ...vless, shortId: generateHex(8) })
                                    }
                                  />
                                }
                              />
                              <input
                                type="text"
                                value={vless.shortId}
                                onChange={(e) =>
                                  setVless({ ...vless, shortId: e.target.value })
                                }
                                className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12px] text-white"
                              />
                            </div>
                            <div>
                              <FieldLabel label="SpiderX" />
                              <input
                                type="text"
                                value={vless.spiderX}
                                onChange={(e) =>
                                  setVless({ ...vless, spiderX: e.target.value })
                                }
                                placeholder="/"
                                className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12px] text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Параметры TLS */}
                      {vless.security === 'tls' && (
                        <div className="space-y-3 border-t border-white/10 pt-3">
                          <div>
                            <FieldLabel label="Домен / SNI" />
                            <input
                              type="text"
                              value={vless.tlsDomain}
                              onChange={(e) =>
                                setVless({ ...vless, tlsDomain: e.target.value })
                              }
                              placeholder={hostDomain || 'vpn.example.com'}
                              className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                            />
                          </div>
                          <div>
                            <FieldLabel label="ALPN" />
                            <input
                              type="text"
                              value={vless.alpn}
                              onChange={(e) => setVless({ ...vless, alpn: e.target.value })}
                              placeholder="h2,http/1.1"
                              className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <div className="text-[13px] text-white/90">
                                Авто-сертификат ACME
                              </div>
                              <div className="text-[11px] text-white/45">
                                Использовать SSL из Настроек хоста
                              </div>
                            </div>
                            <JellySwitch
                              size="sm"
                              checked={vless.useAutoCert}
                              onChange={(useAutoCert) =>
                                setVless({ ...vless, useAutoCert })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ==================== HYSTERIA2 ==================== */}
                  {protocol === 'hysteria2' && (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="UDP Порт" />
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={hy2.port}
                            onChange={(e) =>
                              setHy2({ ...hy2, port: Number(e.target.value) || 8443 })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                        <div>
                          <FieldLabel label="Port Hopping (опц.)" />
                          <input
                            type="text"
                            value={hy2.portHopping}
                            onChange={(e) =>
                              setHy2({ ...hy2, portHopping: e.target.value })
                            }
                            placeholder="20000-50000"
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12.5px] text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel
                          label="Пароль авторизации"
                          action={
                            <GenButton
                              onClick={() =>
                                setHy2({ ...hy2, password: generatePassword(18) })
                              }
                            />
                          }
                        />
                        <input
                          type="text"
                          value={hy2.password}
                          onChange={(e) => setHy2({ ...hy2, password: e.target.value })}
                          className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                        />
                      </div>

                      <div>
                        <FieldLabel label="Обфускация (Obfs)" />
                        <SegmentedControl
                          layoutPrefix="hy2-obfs"
                          value={hy2.obfs}
                          onChange={(obfs) => setHy2({ ...hy2, obfs })}
                          options={[
                            { value: 'salamander', label: 'Salamander' },
                            { value: 'none', label: 'Выключена' },
                          ]}
                        />
                      </div>

                      {hy2.obfs === 'salamander' && (
                        <div>
                          <FieldLabel
                            label="Пароль Salamander"
                            action={
                              <GenButton
                                onClick={() =>
                                  setHy2({ ...hy2, obfsPassword: generatePassword(16) })
                                }
                              />
                            }
                          />
                          <input
                            type="text"
                            value={hy2.obfsPassword}
                            onChange={(e) =>
                              setHy2({ ...hy2, obfsPassword: e.target.value })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="SNI" />
                          <input
                            type="text"
                            value={hy2.sni}
                            onChange={(e) => setHy2({ ...hy2, sni: e.target.value })}
                            placeholder={hostDomain || 'edge.domain.io'}
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12px] text-white"
                          />
                        </div>
                        <div>
                          <FieldLabel label="Маскировка (URL)" />
                          <input
                            type="text"
                            value={hy2.masqueradeUrl}
                            onChange={(e) =>
                              setHy2({ ...hy2, masqueradeUrl: e.target.value })
                            }
                            placeholder="https://bing.com"
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12px] text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="Лимит Up (Мбит/с)" />
                          <input
                            type="number"
                            min={1}
                            value={hy2.upMbps}
                            onChange={(e) =>
                              setHy2({ ...hy2, upMbps: Number(e.target.value) || 100 })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                        <div>
                          <FieldLabel label="Лимит Down (Мбит/с)" />
                          <input
                            type="number"
                            min={1}
                            value={hy2.downMbps}
                            onChange={(e) =>
                              setHy2({ ...hy2, downMbps: Number(e.target.value) || 200 })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5 border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[13px] text-white/90">
                              Авто-сертификат ACME
                            </div>
                            <div className="text-[11px] text-white/45">
                              Валидный TLS-сертификат домена
                            </div>
                          </div>
                          <JellySwitch
                            size="sm"
                            checked={hy2.useAutoCert}
                            onChange={(useAutoCert) =>
                              setHy2({ ...hy2, useAutoCert })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[13px] text-white/90">
                              Allow Insecure
                            </div>
                            <div className="text-[11px] text-white/45">
                              Для самоподписанного сертификата
                            </div>
                          </div>
                          <JellySwitch
                            size="sm"
                            checked={hy2.insecure}
                            onChange={(insecure) => setHy2({ ...hy2, insecure })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================== MTPROXY (TELEGRAM) ==================== */}
                  {protocol === 'mtproxy' && (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="Порт" />
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={mtproxy.port}
                            onChange={(e) =>
                              setMtproxy({
                                ...mtproxy,
                                port: Number(e.target.value) || 2443,
                              })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                        <div>
                          <FieldLabel label="Воркеры (CPU)" />
                          <input
                            type="number"
                            min={1}
                            max={16}
                            value={mtproxy.workers}
                            onChange={(e) =>
                              setMtproxy({
                                ...mtproxy,
                                workers: Number(e.target.value) || 1,
                              })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel label="Режим защиты" />
                        <SegmentedControl
                          layoutPrefix="mtp-mode"
                          value={mtproxy.mode}
                          onChange={(mode) => setMtproxy({ ...mtproxy, mode })}
                          options={[
                            { value: 'fake-tls', label: 'Fake-TLS (ee)' },
                            { value: 'secure', label: 'Secure (dd)' },
                            { value: 'classic', label: 'Classic' },
                          ]}
                        />
                      </div>

                      <div>
                        <FieldLabel
                          label="Секрет (32 hex)"
                          action={
                            <GenButton
                              onClick={() =>
                                setMtproxy({ ...mtproxy, secret: generateHex(32) })
                              }
                            />
                          }
                        />
                        <input
                          type="text"
                          value={mtproxy.secret}
                          onChange={(e) =>
                            setMtproxy({ ...mtproxy, secret: e.target.value })
                          }
                          className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[11.5px] text-white"
                        />
                      </div>

                      {mtproxy.mode === 'fake-tls' && (
                        <div>
                          <FieldLabel label="Fake-TLS Домен маскировки" />
                          <input
                            type="text"
                            value={mtproxy.fakeTlsDomain}
                            onChange={(e) =>
                              setMtproxy({ ...mtproxy, fakeTlsDomain: e.target.value })
                            }
                            placeholder="cloudflare.com"
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                      )}

                      <div>
                        <FieldLabel label="AD Tag спонсора (опционально)" />
                        <input
                          type="text"
                          value={mtproxy.adTag}
                          onChange={(e) =>
                            setMtproxy({ ...mtproxy, adTag: e.target.value })
                          }
                          placeholder="Получается через @MTProxybot"
                          className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12.5px] text-white placeholder:text-white/30"
                        />
                      </div>
                    </div>
                  )}

                  {/* ==================== SOCKS5 ==================== */}
                  {protocol === 'socks5' && (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="Порт" />
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={socks5.port}
                            onChange={(e) =>
                              setSocks5({
                                ...socks5,
                                port: Number(e.target.value) || 1080,
                              })
                            }
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                        <div>
                          <FieldLabel label="Bind IP" />
                          <input
                            type="text"
                            value={socks5.bindAddress}
                            onChange={(e) =>
                              setSocks5({ ...socks5, bindAddress: e.target.value })
                            }
                            placeholder="0.0.0.0"
                            className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[13px] text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel label="Авторизация" />
                        <SegmentedControl
                          layoutPrefix="socks-auth"
                          value={socks5.authMode}
                          onChange={(authMode) => setSocks5({ ...socks5, authMode })}
                          options={[
                            { value: 'password', label: 'Логин / Пароль' },
                            { value: 'none', label: 'Без пароля' },
                          ]}
                        />
                      </div>

                      {socks5.authMode === 'password' && (
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <FieldLabel label="Логин" />
                            <input
                              type="text"
                              value={socks5.username}
                              onChange={(e) =>
                                setSocks5({ ...socks5, username: e.target.value })
                              }
                              className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12.5px] text-white"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              label="Пароль"
                              action={
                                <GenButton
                                  label="Ген."
                                  onClick={() =>
                                    setSocks5({
                                      ...socks5,
                                      password: generatePassword(14),
                                    })
                                  }
                                />
                              }
                            />
                            <input
                              type="text"
                              value={socks5.password}
                              onChange={(e) =>
                                setSocks5({ ...socks5, password: e.target.value })
                              }
                              className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12.5px] text-white"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <FieldLabel label="Разрешённая подсеть (Allowlist CIDR)" />
                        <input
                          type="text"
                          value={socks5.allowlistCidr}
                          onChange={(e) =>
                            setSocks5({ ...socks5, allowlistCidr: e.target.value })
                          }
                          placeholder="0.0.0.0/0"
                          className="liquid-input font-mono-tech w-full rounded-[13px] px-3 py-2 text-[12.5px] text-white"
                        />
                      </div>

                      <div className="space-y-2.5 border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[13px] text-white/90">
                              UDP Associate
                            </div>
                            <div className="text-[11px] text-white/45">
                              Проксирование UDP-трафика и звонков
                            </div>
                          </div>
                          <JellySwitch
                            size="sm"
                            checked={socks5.udpAssociate}
                            onChange={(udpAssociate) =>
                              setSocks5({ ...socks5, udpAssociate })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[13px] text-white/90">
                              TLS Обёртка
                            </div>
                            <div className="text-[11px] text-white/45">
                              Шифровать транспорт сертификатом хоста
                            </div>
                          </div>
                          <JellySwitch
                            size="sm"
                            checked={socks5.tlsWrap}
                            onChange={(tlsWrap) => setSocks5({ ...socks5, tlsWrap })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Сразу включить в /sub */}
              <div className="flex items-center justify-between rounded-[18px] border border-white/12 bg-white/[0.03] px-4 py-3">
                <div>
                  <div className="text-[13.5px] font-medium text-white">
                    Включить сразу в /sub
                  </div>
                  <div className="text-[11px] text-white/45">
                    Запустить inbound и отдавать в подписке
                  </div>
                </div>
                <JellySwitch
                  size="sm"
                  checked={enabledImmediately}
                  onChange={setEnabledImmediately}
                />
              </div>
            </form>

            {/* Фиксированный нижний футер с кнопкой создания */}
            <div className="safe-bottom relative z-10 shrink-0 border-t border-white/10 bg-black/45 px-5 pt-3 backdrop-blur-xl">
              <JellyButton
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.getElementById(
                    'create-key-form'
                  ) as HTMLFormElement | null;
                  form?.requestSubmit();
                }}
              >
                Создать на хосте
              </JellyButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

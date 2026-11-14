import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Globe,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { LiquidGlassCard } from '../shaders/LiquidGlassSurface';
import { JellySwitch } from '../ui/JellySwitch';
import { JellyButton } from '../ui/JellyButton';
import { api } from '../../api/client';
import type { HostSettings, SubscriptionHeaders, VpnKey } from '../../types/vpn';
import { JELLY_ITEM_VARIANTS, JELLY_SNAP } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface SettingsTabProps {
  settings: HostSettings;
  keys: VpnKey[];
  headers: SubscriptionHeaders;
  onSaveSettings: (next: HostSettings) => void;
  onNotify: (msg: string) => void;
}

const CHALLENGE_MODES: { value: HostSettings['acmeChallenge']; label: string }[] = [
  { value: 'http-01', label: 'HTTP-01' },
  { value: 'tls-alpn-01', label: 'ALPN-01' },
  { value: 'dns-01', label: 'DNS-01' },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  keys,
  headers,
  onSaveSettings,
  onNotify,
}) => {
  const [draft, setDraft] = useState<HostSettings>(settings);
  const [renewingCert, setRenewingCert] = useState(false);
  const [restartingCore, setRestartingCore] = useState(false);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(settings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // API HOOK: PUT /api/v1/settings
    triggerHaptic('success');
    onSaveSettings(draft);
    onNotify('Настройки хоста сохранены');
  };

  const handleRenewCert = async () => {
    if (renewingCert) return;
    setRenewingCert(true);
    triggerHaptic('medium');
    try {
      await api.renewAcme();
      const updated: HostSettings = {
        ...draft,
        certStatus: 'active',
        certExpiresAt: '90 дней',
      };
      setDraft(updated);
      onSaveSettings(updated);
      triggerHaptic('success');
      onNotify(`SSL для ${updated.domain} обновлён`);
    } catch (err: any) {
      triggerHaptic('warning');
      onNotify(`Ошибка ACME: ${err?.message || 'сбой'}`);
    } finally {
      setRenewingCert(false);
    }
  };

  const handleRestartCore = async () => {
    if (restartingCore) return;
    setRestartingCore(true);
    triggerHaptic('medium');
    try {
      await api.restartCores();
      triggerHaptic('success');
      onNotify('Ядра Sing-box & MTProxy перезапущены');
    } catch {
      triggerHaptic('warning');
      onNotify('Ошибка перезапуска ядер');
    } finally {
      setRestartingCore(false);
    }
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: draft,
      subscriptionHeaders: headers,
      keys,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nix-vpn-backup-${draft.domain || 'host'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerHaptic('success');
    onNotify('JSON-бэкап экспортирован');
  };

  return (
    <form onSubmit={handleSave} className="space-y-3.5 pb-4">
      {/* 1. ДОМЕН И АВТО-СЕРТИФИКАТЫ (ACME / LET'S ENCRYPT) */}
      <motion.div
        custom={0}
        variants={JELLY_ITEM_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <LiquidGlassCard strong className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[13px] border border-white/20 bg-white/[0.08]">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-[15.5px] font-semibold tracking-tight text-white">
                  Домен и SSL
                </h3>
                <p className="text-[11.5px] text-white/45">
                  Авто-сертификаты Let&apos;s Encrypt
                </p>
              </div>
            </div>

            <JellySwitch
              size="sm"
              checked={draft.acmeEnabled}
              onChange={(acmeEnabled) => setDraft({ ...draft, acmeEnabled })}
              ariaLabel="Автовыпуск ACME сертификатов"
            />
          </div>

          <div className="mt-4 space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[11.5px] font-medium text-white/55">
                Домен панели и подписки /sub
              </label>
              <input
                type="text"
                value={draft.domain}
                onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                placeholder="vpn.yourdomain.com"
                className="liquid-input font-mono-tech w-full rounded-[14px] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/30"
              />
            </div>

            {draft.acmeEnabled && (
              <>
                <div>
                  <label className="mb-1.5 block text-[11.5px] font-medium text-white/55">
                    ACME Email
                  </label>
                  <input
                    type="email"
                    value={draft.acmeEmail}
                    onChange={(e) =>
                      setDraft({ ...draft, acmeEmail: e.target.value })
                    }
                    placeholder="admin@yourdomain.com"
                    className="liquid-input font-mono-tech w-full rounded-[14px] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/30"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11.5px] font-medium text-white/55">
                    Метод валидации ACME
                  </label>
                  <div className="flex items-center gap-1 rounded-[14px] border border-white/14 bg-white/[0.04] p-1">
                    {CHALLENGE_MODES.map((m) => {
                      const selected = draft.acmeChallenge === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            triggerHaptic('selection');
                            setDraft({ ...draft, acmeChallenge: m.value });
                          }}
                          className="relative flex-1 cursor-pointer rounded-[10px] py-2 font-mono-tech text-[11.5px] font-medium"
                        >
                          {selected && (
                            <motion.span
                              layoutId="acme-challenge-pill"
                              transition={JELLY_SNAP}
                              className="absolute inset-0 rounded-[10px] bg-white shadow-[0_2px_10px_rgba(255,255,255,0.22)]"
                            />
                          )}
                          <span
                            className={`relative z-10 ${
                              selected ? 'text-black font-semibold' : 'text-white/55'
                            }`}
                          >
                            {m.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Статус текущего сертификата */}
                <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/14 bg-black/45 px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-white">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-white" />
                      <span className="truncate">{draft.certIssuer}</span>
                    </div>
                    <div className="font-mono-tech mt-0.5 text-[11px] text-white/45">
                      {renewingCert
                        ? 'Выпуск сертификата...'
                        : `Валиден до ${draft.certExpiresAt}`}
                    </div>
                  </div>

                  <JellyButton
                    variant="outline"
                    size="sm"
                    disabled={renewingCert}
                    onClick={handleRenewCert}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${renewingCert ? 'animate-spin' : ''}`}
                    />
                    <span>Обновить</span>
                  </JellyButton>
                </div>
              </>
            )}
          </div>
        </LiquidGlassCard>
      </motion.div>

      {/* 2. СЕТЬ И ДОСТУП (ПРОЧЕЕ) */}
      <motion.div
        custom={1}
        variants={JELLY_ITEM_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <LiquidGlassCard className="p-5 space-y-4">
          <h3 className="text-[15.5px] font-semibold tracking-tight text-white">
            Сеть и доступ
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-medium text-white">
                TCP BBR Ускорение
              </div>
              <div className="text-[11.5px] text-white/45">
                Оптимизация контроля перегрузок ядра Linux
              </div>
            </div>
            <JellySwitch
              size="sm"
              checked={draft.bbrEnabled}
              onChange={(bbrEnabled) => setDraft({ ...draft, bbrEnabled })}
            />
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3.5">
            <div>
              <div className="text-[13.5px] font-medium text-white">
                Поддержка IPv6
              </div>
              <div className="text-[11.5px] text-white/45">
                Разрешить исходящий dual-stack трафик
              </div>
            </div>
            <JellySwitch
              size="sm"
              checked={draft.ipv6Enabled}
              onChange={(ipv6Enabled) => setDraft({ ...draft, ipv6Enabled })}
            />
          </div>

          <div className="space-y-3 border-t border-white/10 pt-3.5">
            <div>
              <label className="mb-1.5 block text-[11.5px] font-medium text-white/55">
                Маскировка корня (Fallback URL)
              </label>
              <input
                type="url"
                value={draft.fallbackSite}
                onChange={(e) =>
                  setDraft({ ...draft, fallbackSite: e.target.value })
                }
                placeholder="https://www.apple.com"
                className="liquid-input font-mono-tech w-full rounded-[14px] px-3.5 py-2.5 text-[12.5px] text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11.5px] font-medium text-white/55">
                Admin Telegram ID (через запятую)
              </label>
              <input
                type="text"
                value={draft.adminTelegramIds}
                onChange={(e) =>
                  setDraft({ ...draft, adminTelegramIds: e.target.value })
                }
                placeholder="492817301"
                className="liquid-input font-mono-tech w-full rounded-[14px] px-3.5 py-2.5 text-[12.5px] text-white"
              />
            </div>
          </div>

          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={JELLY_SNAP}
              className="pt-1"
            >
              <JellyButton type="submit" variant="primary" size="lg" className="w-full">
                <Save className="h-4 w-4" />
                <span>Сохранить настройки</span>
              </JellyButton>
            </motion.div>
          )}
        </LiquidGlassCard>
      </motion.div>

      {/* 3. ЯДРО И РЕЗЕРВНОЕ КОПИРОВАНИЕ */}
      <motion.div
        custom={2}
        variants={JELLY_ITEM_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <LiquidGlassCard className="p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <JellyButton
              variant="outline"
              size="md"
              disabled={restartingCore}
              onClick={handleRestartCore}
            >
              <RotateCcw
                className={`h-4 w-4 ${restartingCore ? 'animate-spin' : ''}`}
              />
              <span>{restartingCore ? 'Рестарт...' : 'Рестарт ядра'}</span>
            </JellyButton>

            <JellyButton variant="outline" size="md" onClick={handleExportBackup}>
              <Download className="h-4 w-4" />
              <span>Бэкап JSON</span>
            </JellyButton>
          </div>

          <div className="mt-3 text-center font-mono-tech text-[10.5px] text-white/35">
            {draft.coreVersion}
          </div>
        </LiquidGlassCard>
      </motion.div>
    </form>
  );
};

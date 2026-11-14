import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, QrCode, Trash2, X } from 'lucide-react';
import {
  buildKeyUri,
  PROTOCOL_META,
  type Hysteria2Config,
  type MtProxyConfig,
  type Socks5Config,
  type VlessConfig,
  type VpnKey,
} from '../../types/vpn';
import { ProtocolIconBadge } from '../icons/ProtocolIcons';
import { JellyButton } from '../ui/JellyButton';
import { QrCodeSvg } from '../ui/QrCodeSvg';
import { JELLY_SHEET } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface KeyDetailSheetProps {
  vpnKey: VpnKey | null;
  hostDomain: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onNotify: (msg: string) => void;
}

export const KeyDetailSheet: React.FC<KeyDetailSheetProps> = ({
  vpnKey,
  hostDomain,
  onClose,
  onDelete,
  onNotify,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setCopied(false);
    setShowQr(false);
    setConfirmDelete(false);
  }, [vpnKey?.id]);

  const uri = vpnKey ? buildKeyUri(vpnKey, hostDomain) : '';

  const copyUri = async () => {
    try {
      await navigator.clipboard.writeText(uri);
    } catch {
      // ignore fallback
    }
    triggerHaptic('success');
    setCopied(true);
    onNotify('Ссылка ключа скопирована');
    setTimeout(() => setCopied(false), 1800);
  };

  const renderParamsSummary = (key: VpnKey): { label: string; value: string }[] => {
    if (key.protocol === 'vless') {
      const c = key.config as VlessConfig;
      return [
        { label: 'Порт', value: String(c.port) },
        { label: 'Сеть', value: c.network.toUpperCase() },
        { label: 'Защита', value: c.security.toUpperCase() },
        {
          label: c.security === 'reality' ? 'SNI / FP' : 'Flow',
          value:
            c.security === 'reality'
              ? `${c.realitySni} · ${c.fingerprint}`
              : c.flow,
        },
      ];
    }
    if (key.protocol === 'hysteria2') {
      const c = key.config as Hysteria2Config;
      return [
        { label: 'UDP Порт', value: c.portHopping ? `${c.port} (${c.portHopping})` : String(c.port) },
        { label: 'Обфускация', value: c.obfs === 'salamander' ? 'Salamander' : 'Нет' },
        { label: 'Маскировка', value: c.masqueradeUrl || '—' },
        { label: 'Лимит', value: `↑${c.upMbps} / ↓${c.downMbps} Мбит/с` },
      ];
    }
    if (key.protocol === 'mtproxy') {
      const c = key.config as MtProxyConfig;
      return [
        { label: 'Порт', value: String(c.port) },
        { label: 'Режим', value: c.mode },
        { label: 'Домен TLS', value: c.mode === 'fake-tls' ? c.fakeTlsDomain : '—' },
        { label: 'Воркеры', value: String(c.workers) },
      ];
    }
    const c = key.config as Socks5Config;
    return [
      { label: 'Порт / Bind', value: `${c.bindAddress}:${c.port}` },
      { label: 'Авторизация', value: c.authMode === 'password' ? c.username : 'Открытый' },
      { label: 'UDP', value: c.udpAssociate ? 'Включён' : 'Выключен' },
      { label: 'TLS Обёртка', value: c.tlsWrap ? 'Да' : 'Нет' },
    ];
  };

  return (
    <AnimatePresence>
      {vpnKey && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            initial={{ y: '100%', scaleX: 0.94, opacity: 0.5 }}
            animate={{ y: 0, scaleX: 1, opacity: 1 }}
            exit={{ y: '100%', scaleX: 0.96, opacity: 0 }}
            transition={JELLY_SHEET}
            className="liquid-glass-strong safe-bottom relative z-10 w-full max-w-[430px] overflow-hidden rounded-t-[32px] px-5 pt-3"
          >
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-white/25" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProtocolIconBadge protocol={vpnKey.protocol} active={vpnKey.enabled} />
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-semibold text-white">
                    {vpnKey.name}
                  </div>
                  <div className="font-mono-tech text-[11.5px] text-white/50">
                    {PROTOCOL_META[vpnKey.protocol].label} ·{' '}
                    {vpnKey.enabled ? 'Включён в /sub' : 'Отключён'}
                  </div>
                </div>
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

            {/* Параметры хоста */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {renderParamsSummary(vpnKey).map((row) => (
                <div
                  key={row.label}
                  className="rounded-[15px] border border-white/10 bg-white/[0.03] px-3 py-2.5"
                >
                  <div className="text-[10.5px] text-white/45">{row.label}</div>
                  <div className="font-mono-tech mt-0.5 truncate text-[12px] text-white/90">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Ссылка подключения */}
            <div className="mt-3.5 rounded-[16px] border border-white/12 bg-black/50 p-3">
              <div className="font-mono-tech break-all text-[11px] leading-relaxed text-white/65 line-clamp-3">
                {uri}
              </div>
            </div>

            {/* Опциональный QR */}
            <AnimatePresence>
              {showQr && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                  className="flex justify-center overflow-hidden pt-4"
                >
                  <QrCodeSvg value={uri} size={172} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Действия */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <JellyButton variant="primary" size="md" onClick={copyUri}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Скопировано' : 'Копировать'}</span>
              </JellyButton>
              <JellyButton
                variant="outline"
                size="md"
                onClick={() => setShowQr((s) => !s)}
              >
                <QrCode className="h-4 w-4" />
                <span>{showQr ? 'Скрыть QR' : 'QR-код'}</span>
              </JellyButton>
            </div>

            {/* Двухэтапное монохромное удаление */}
            <div className="mt-3 pb-2">
              {!confirmDelete ? (
                <JellyButton
                  variant="ghost"
                  size="md"
                  className="w-full border border-dashed border-white/15 text-white/60 hover:border-white/35 hover:text-white"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Удалить ключ с хоста</span>
                </JellyButton>
              ) : (
                <div className="flex gap-2">
                  <JellyButton
                    variant="outline"
                    size="md"
                    className="flex-1"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Отмена
                  </JellyButton>
                  <JellyButton
                    variant="primary"
                    size="md"
                    className="flex-1"
                    onClick={() => {
                      // API HOOK: DELETE /api/v1/keys/{vpnKey.id}
                      triggerHaptic('heavy');
                      onDelete(vpnKey.id);
                      onClose();
                    }}
                  >
                    Точно удалить
                  </JellyButton>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

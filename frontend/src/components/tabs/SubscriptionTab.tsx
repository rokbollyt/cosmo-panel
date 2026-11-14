import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Code2, Copy, QrCode, Save } from 'lucide-react';
import { LiquidGlassCard } from '../shaders/LiquidGlassSurface';
import { ProtocolGlyph } from '../icons/ProtocolIcons';
import { JellyButton } from '../ui/JellyButton';
import { JellySwitch } from '../ui/JellySwitch';
import { QrCodeSvg } from '../ui/QrCodeSvg';
import {
  buildKeyUri,
  buildSubscriptionHeadersText,
  type SubscriptionHeaders,
  type VpnKey,
} from '../../types/vpn';
import { JELLY_ITEM_VARIANTS } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface SubscriptionTabProps {
  keys: VpnKey[];
  domain: string;
  headers: SubscriptionHeaders;
  onSaveHeaders: (next: SubscriptionHeaders) => void;
  onNotify: (msg: string) => void;
}

export const SubscriptionTab: React.FC<SubscriptionTabProps> = ({
  keys,
  domain,
  headers,
  onSaveHeaders,
  onNotify,
}) => {
  const [draft, setDraft] = useState<SubscriptionHeaders>(headers);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const enabledKeys = useMemo(() => keys.filter((k) => k.enabled), [keys]);
  const subUrl = `https://${domain.trim() || 'host.local'}/sub`;

  const rawHeadersText = useMemo(
    () => buildSubscriptionHeadersText(draft),
    [draft]
  );

  const rawBodyPreview = useMemo(() => {
    const uris = enabledKeys.map((k) => buildKeyUri(k, domain));
    return [rawHeadersText, '', ...uris].filter((line, i) => i > 0 || line).join('\n');
  }, [enabledKeys, domain, rawHeadersText]);

  const hasChanges =
    draft.anonce !== headers.anonce ||
    draft.profileTitle !== headers.profileTitle ||
    draft.encodeTitleBase64 !== headers.encodeTitleBase64 ||
    draft.supportUrl !== headers.supportUrl ||
    draft.profileWebPageUrl !== headers.profileWebPageUrl;

  const handleCopySub = async () => {
    try {
      await navigator.clipboard.writeText(subUrl);
    } catch {
      // ignore clipboard fallback
    }
    triggerHaptic('success');
    setCopied(true);
    onNotify('Ссылка /sub скопирована');
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // API HOOK: PUT /api/v1/subscription/headers с телом `draft`
    triggerHaptic('success');
    onSaveHeaders(draft);
    onNotify('Заголовки /sub обновлены');
  };

  return (
    <div className="space-y-3.5 pb-4">
      {/* 1. ЕДИНАЯ ПОДПИСКА /sub */}
      <motion.div
        custom={0}
        variants={JELLY_ITEM_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <LiquidGlassCard strong shader shaderIntensity={0.82} className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium tracking-[0.14em] text-white/45 uppercase">
                Единая подписка
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono-tech text-[22px] font-semibold tracking-tight text-white">
                  /sub
                </span>
                <span className="rounded-full border border-white/18 bg-white/[0.08] px-2.5 py-0.5 font-mono-tech text-[11px] text-white/80">
                  {enabledKeys.length} ключ.
                </span>
              </div>
            </div>

            {/* Мини-иконки активных ключей в /sub */}
            <div className="flex items-center -space-x-1.5">
              {enabledKeys.slice(0, 5).map((k) => (
                <div
                  key={k.id}
                  title={k.name}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/80 text-white shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
                >
                  <ProtocolGlyph protocol={k.protocol} size={14} />
                </div>
              ))}
              {enabledKeys.length === 0 && (
                <span className="text-[11px] text-white/35">Нет активных</span>
              )}
            </div>
          </div>

          {/* URL эндпоинта */}
          <div className="mt-4 rounded-[15px] border border-white/14 bg-black/45 px-3.5 py-2.5 font-mono-tech text-[12.5px] text-white/85 break-all">
            {subUrl}
          </div>

          {/* Кнопки действий */}
          <div className="mt-3.5 flex items-center gap-2">
            <JellyButton
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleCopySub}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Скопировано' : 'Копировать /sub'}</span>
            </JellyButton>

            <JellyButton
              variant={showQr ? 'primary' : 'outline'}
              size="icon"
              className="h-11 w-11 rounded-[16px]"
              ariaLabel="Показать QR-код"
              onClick={() => {
                setShowQr((v) => !v);
                setShowRaw(false);
              }}
            >
              <QrCode className="h-4 w-4" />
            </JellyButton>

            <JellyButton
              variant={showRaw ? 'primary' : 'outline'}
              size="icon"
              className="h-11 w-11 rounded-[16px]"
              ariaLabel="Просмотр ответа /sub"
              onClick={() => {
                setShowRaw((v) => !v);
                setShowQr(false);
              }}
            >
              <Code2 className="h-4 w-4" />
            </JellyButton>
          </div>

          {/* Выпадающий QR-код */}
          <AnimatePresence>
            {showQr && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.92 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                className="flex flex-col items-center overflow-hidden pt-5"
              >
                <QrCodeSvg value={subUrl} size={184} />
                <span className="mt-2.5 text-[11px] text-white/45">
                  Импорт в Happ · v2rayTun · Hiddify · Shadowrocket
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Выпадающий RAW предпросмотр /sub */}
          <AnimatePresence>
            {showRaw && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                className="overflow-hidden pt-4"
              >
                <div className="rounded-[16px] border border-white/12 bg-black/75 p-3">
                  <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-mono-tech text-white/40 uppercase">
                    <span>GET /sub · preview</span>
                    <span>{enabledKeys.length} URI</span>
                  </div>
                  <pre className="no-scrollbar max-h-44 overflow-auto whitespace-pre-wrap break-all font-mono-tech text-[10.5px] leading-relaxed text-white/75">
                    {rawBodyPreview || '# Включите хотя бы один ключ во вкладке Ключи'}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </LiquidGlassCard>
      </motion.div>

      {/* 2. НАСТРОЙКА ЗАГОЛОВКОВ ПОДПИСКИ */}
      <motion.div
        custom={1}
        variants={JELLY_ITEM_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <LiquidGlassCard className="p-5">
          <div className="mb-4">
            <h3 className="text-[16px] font-semibold tracking-tight text-white">
              Заголовки ответа
            </h3>
            <p className="mt-0.5 text-[12px] text-white/45">
              Передаются клиенту при каждом обновлении /sub
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* #profile-title */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono-tech text-[11.5px] text-white/75">
                  #profile-title:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tech text-[10.5px] text-white/45">
                    base64
                  </span>
                  <JellySwitch
                    size="sm"
                    checked={draft.encodeTitleBase64}
                    onChange={(encodeTitleBase64) =>
                      setDraft({ ...draft, encodeTitleBase64 })
                    }
                    ariaLabel="Кодировать profile-title в Base64"
                  />
                </div>
              </div>
              <input
                type="text"
                value={draft.profileTitle}
                onChange={(e) =>
                  setDraft({ ...draft, profileTitle: e.target.value })
                }
                placeholder="NIX PRIVATE"
                className="liquid-input w-full rounded-[14px] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/30"
              />
            </div>

            {/* #anonce */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono-tech text-[11.5px] text-white/75">
                  #anonce:
                </span>
                <span className="text-[10.5px] text-white/40">Объявление</span>
              </div>
              <input
                type="text"
                value={draft.anonce}
                onChange={(e) => setDraft({ ...draft, anonce: e.target.value })}
                placeholder="Текст уведомления внутри клиента"
                className="liquid-input w-full rounded-[14px] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/30"
              />
            </div>

            {/* #support-url */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono-tech text-[11.5px] text-white/75">
                  #support-url:
                </span>
                <span className="text-[10.5px] text-white/40">Поддержка</span>
              </div>
              <input
                type="url"
                value={draft.supportUrl}
                onChange={(e) =>
                  setDraft({ ...draft, supportUrl: e.target.value })
                }
                placeholder="https://t.me/username"
                className="liquid-input font-mono-tech w-full rounded-[14px] px-3.5 py-2.5 text-[12.5px] text-white placeholder:text-white/30"
              />
            </div>

            {/* #profile-web-page-url */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono-tech text-[11.5px] text-white/75">
                  #profile-web-page-url:
                </span>
                <span className="text-[10.5px] text-white/40">Веб-страница</span>
              </div>
              <input
                type="url"
                value={draft.profileWebPageUrl}
                onChange={(e) =>
                  setDraft({ ...draft, profileWebPageUrl: e.target.value })
                }
                placeholder="https://domain.io"
                className="liquid-input font-mono-tech w-full rounded-[14px] px-3.5 py-2.5 text-[12.5px] text-white placeholder:text-white/30"
              />
            </div>

            {/* Живая кнопка сохранения */}
            <div className="pt-1">
              <JellyButton
                type="submit"
                variant={hasChanges ? 'primary' : 'outline'}
                size="lg"
                className="w-full"
              >
                <Save className="h-4 w-4" />
                <span>{hasChanges ? 'Сохранить заголовки' : 'Заголовки актуальны'}</span>
              </JellyButton>
            </div>
          </form>
        </LiquidGlassCard>
      </motion.div>
    </div>
  );
};

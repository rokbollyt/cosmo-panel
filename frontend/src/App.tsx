import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { SnowLiquidShader } from './components/shaders/SnowLiquidShader';
import { LiquidGlassFilterDefs } from './components/shaders/LiquidGlassSurface';
import { LiquidTabBar } from './components/layout/LiquidTabBar';
import { OverviewTab } from './components/tabs/OverviewTab';
import { KeysTab } from './components/tabs/KeysTab';
import { SubscriptionTab } from './components/tabs/SubscriptionTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { CreateKeySheet } from './components/modals/CreateKeySheet';
import { KeyDetailSheet } from './components/modals/KeyDetailSheet';
import {
  INITIAL_HOST_SETTINGS,
  INITIAL_KEYS,
  INITIAL_SUBSCRIPTION_HEADERS,
} from './data/mockData';
import type {
  HostSettings,
  SubscriptionHeaders,
  TabId,
  VpnKey,
} from './types/vpn';
import { api, isTelegramOrAuthorized, setAuthToken, type SystemStats } from './api/client';
import { initTelegramMiniApp } from './utils/haptics';
import { JELLY_SNAP, JELLY_TAB_VARIANTS } from './utils/motion';

// ============================================================================
// COSMO ADMIN VPN PANEL — TELEGRAM MINI APP FRONTEND
// Монохромный OLED + WebGL снег + Liquid Glass шейдеры + Jelly анимации
// ============================================================================

export function App() {
  const [authorized, setAuthorized] = useState<boolean>(() => isTelegramOrAuthorized());
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    if (!authorized) {
      const interval = setInterval(() => {
        if (isTelegramOrAuthorized()) {
          setAuthorized(true);
        }
      }, 60);
      const timer = setTimeout(() => clearInterval(interval), 1200);
      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [authorized]);

  // Состояние данных с синхронизацией через Rust REST API
  const [keys, setKeys] = useState<VpnKey[]>(INITIAL_KEYS);
  const [subHeaders, setSubHeaders] = useState<SubscriptionHeaders>(
    INITIAL_SUBSCRIPTION_HEADERS
  );
  const [hostSettings, setHostSettings] = useState<HostSettings>(
    INITIAL_HOST_SETTINGS
  );
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [trafficSeries, setTrafficSeries] = useState<TrafficPoint[]>([]);

  // Модальные окна
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<VpnKey | null>(null);

  // Желейный монохромный тост
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToast({ id, message });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 2400);
  }, []);

  // Первоначальная загрузка данных с сервера (только если авторизован)
  useEffect(() => {
    if (!authorized) return;

    initTelegramMiniApp();

    const loadData = async () => {
      try {
        const [fetchedKeys, fetchedHeaders, fetchedSettings, overview] =
          await Promise.allSettled([
            api.getKeys(),
            api.getSubscriptionHeaders(),
            api.getSettings(),
            api.getOverview(),
          ]);

        if (fetchedKeys.status === 'fulfilled') setKeys(fetchedKeys.value);
        if (fetchedHeaders.status === 'fulfilled') setSubHeaders(fetchedHeaders.value);
        if (fetchedSettings.status === 'fulfilled') setHostSettings(fetchedSettings.value);
        if (overview.status === 'fulfilled') {
          setSystemStats(overview.value.stats);
          if (overview.value.trafficSeries) {
            setTrafficSeries(overview.value.trafficSeries);
          }
        }
      } catch (e) {
        console.warn('Backend unavailable, running in local fallback mode', e);
      }
    };

    loadData();

    // Периодическое обновление метрик системы
    const timer = setInterval(async () => {
      try {
        const ov = await api.getOverview();
        setSystemStats(ov.stats);
        if (ov.trafficSeries) {
          setTrafficSeries(ov.trafficSeries);
        }
      } catch {
        // ignore offline error
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [authorized]);

  const handleToggleKey = useCallback(
    async (id: string, enabled: boolean) => {
      // Оптимистичное обновление UI
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, enabled } : k))
      );

      try {
        await api.toggleKey(id, enabled);
        showToast(enabled ? 'Ключ включён в /sub' : 'Ключ убран из /sub');
      } catch (err) {
        console.error('Failed to toggle key:', err);
        // Откат при ошибке
        setKeys((prev) =>
          prev.map((k) => (k.id === id ? { ...k, enabled: !enabled } : k))
        );
        showToast('Ошибка сохранения ключа на сервере');
      }
    },
    [showToast]
  );

  const handleCreateKey = useCallback(
    async (newKey: VpnKey) => {
      setKeys((prev) => [newKey, ...prev]);
      try {
        const created = await api.createKey(newKey);
        setKeys((prev) => [created, ...prev.filter((k) => k.id !== newKey.id)]);
        showToast(`Ключ «${newKey.name}» создан`);
      } catch (err) {
        console.error('Failed to create key on backend:', err);
        showToast(`Ключ «${newKey.name}» создан локально`);
      }
    },
    [showToast]
  );

  const handleDeleteKey = useCallback(
    async (id: string) => {
      setKeys((prev) => prev.filter((k) => k.id !== id));
      try {
        await api.deleteKey(id);
        showToast('Ключ удалён с хоста');
      } catch (err) {
        console.error('Failed to delete key on backend:', err);
        showToast('Ключ удалён');
      }
    },
    [showToast]
  );

  const handleSaveHeaders = useCallback(
    async (next: SubscriptionHeaders) => {
      setSubHeaders(next);
      try {
        await api.saveSubscriptionHeaders(next);
        showToast('Заголовки /sub обновлены на сервере');
      } catch (err) {
        console.error('Failed to save sub headers:', err);
        showToast('Заголовки сохранены локально');
      }
    },
    [showToast]
  );

  const handleSaveHostSettings = useCallback(
    async (next: HostSettings) => {
      setHostSettings(next);
      try {
        await api.saveSettings(next);
        showToast('Настройки хоста сохранены на сервере');
      } catch (err) {
        console.error('Failed to save settings:', err);
        showToast('Настройки сохранены локально');
      }
    },
    [showToast]
  );

  const [tokenInput, setTokenInput] = useState('');

  if (!authorized) {
    return (
      <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black px-6 text-center text-white">
        <LiquidGlassFilterDefs />
        <SnowLiquidShader />
        <div className="relative z-10 mx-auto max-w-[340px] p-6">
          <div className="liquid-glass mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[20px]">
            <ShieldAlert className="h-7 w-7 text-white/50" />
          </div>
          <h1 className="text-[17px] font-semibold tracking-wide text-white">
            403 · Доступ ограничен
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/45">
            Узел защищен. Панель управления доступна только через авторизованный Telegram-бот в режиме Mini App или по токену администратора.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tokenInput.trim()) {
                setAuthToken(tokenInput.trim());
                setAuthorized(true);
              }
            }}
            className="mt-6 flex flex-col gap-2.5"
          >
            <input
              type="password"
              placeholder="Секретный токен админа"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="liquid-glass rounded-xl px-3.5 py-2.5 text-center font-mono text-[12px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/40"
            />
            <button
              type="submit"
              className="rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 px-4 py-2 text-[12.5px] font-medium text-white transition-all"
            >
              Войти в панель
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full bg-black text-white">
      {/* Глобальный SVG-фильтр преломления для Liquid Glass */}
      <LiquidGlassFilterDefs />

      {/* Полноэкранный WebGL-шейдер: чисто чёрный фон + многослойный снег */}
      <SnowLiquidShader />

      {/* Желейный монохромный тост поверх интерфейса */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -24, scaleX: 0.86, scaleY: 1.15 }}
              animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
              exit={{ opacity: 0, y: -18, scaleX: 1.06, scaleY: 0.85 }}
              transition={JELLY_SNAP}
              className="liquid-glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_12px_32px_rgba(0,0,0,0.9)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Вертикальный контейнер Telegram Mini App */}
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-4 pt-[max(14px,env(safe-area-inset-top))] pb-28">
        {/* Минималистичная верхняя шапка админ-панели */}
        <header className="mb-4 flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2.5">
            <div className="liquid-glass flex h-9 w-9 items-center justify-center rounded-[13px]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 19V5L13 19V5"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="19" cy="6.5" r="2.2" fill="#ffffff" />
                <path
                  d="M19 12V19"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeOpacity="0.65"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15.5px] font-semibold tracking-[0.04em] text-white">
                  COSMO
                </span>
                <span className="rounded-full border border-white/18 bg-white/[0.06] px-2 py-0.5 font-mono-tech text-[9.5px] tracking-[0.14em] text-white/65 uppercase">
                  ADMIN
                </span>
              </div>
            </div>
          </div>

          {/* Лаконичный индикатор хоста */}
          <div className="liquid-glass flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-mono" />
            <span className="font-mono-tech text-[11px] text-white/75">
              /sub · {keys.filter((k) => k.enabled).length}
            </span>
          </div>
        </header>

        {/* Основной контент вкладок с упругими желе-переходами */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="tab-overview"
                variants={JELLY_TAB_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <OverviewTab
                  keys={keys}
                  domain={hostSettings.domain}
                  stats={systemStats}
                  trafficSeries={trafficSeries}
                />
              </motion.div>
            )}

            {activeTab === 'keys' && (
              <motion.div
                key="tab-keys"
                variants={JELLY_TAB_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <KeysTab
                  keys={keys}
                  onToggleKey={handleToggleKey}
                  onOpenCreate={() => setCreateOpen(true)}
                  onSelectKey={(k) => setSelectedKey(k)}
                />
              </motion.div>
            )}

            {activeTab === 'subscription' && (
              <motion.div
                key="tab-subscription"
                variants={JELLY_TAB_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <SubscriptionTab
                  keys={keys}
                  domain={hostSettings.domain}
                  headers={subHeaders}
                  onSaveHeaders={handleSaveHeaders}
                  onNotify={showToast}
                />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="tab-settings"
                variants={JELLY_TAB_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <SettingsTab
                  settings={hostSettings}
                  keys={keys}
                  headers={subHeaders}
                  onSaveSettings={handleSaveHostSettings}
                  onNotify={showToast}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Плавающая нижняя Liquid Glass навигация */}
      <LiquidTabBar activeTab={activeTab} onChange={setActiveTab} />

      {/* Модальное окно создания ключа со всеми параметрами хоста */}
      <CreateKeySheet
        open={createOpen}
        hostDomain={hostSettings.domain}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateKey}
      />

      {/* Модальное окно деталей/удаления выбранного ключа */}
      <KeyDetailSheet
        vpnKey={selectedKey}
        hostDomain={hostSettings.domain}
        onClose={() => setSelectedKey(null)}
        onDelete={handleDeleteKey}
        onNotify={showToast}
      />
    </div>
  );
}

export default App;

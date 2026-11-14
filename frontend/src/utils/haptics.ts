// ============================================================================
// TELEGRAM MINI APP BRIDGE (HAPTICS + VIEWPORT)
// Безопасно работает как внутри Telegram WebApp, так и в обычном браузере
// ============================================================================

interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged?: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function initTelegramMiniApp(): void {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.('#000000');
    tg.setBackgroundColor?.('#000000');
  } catch {
    // Игнорируем в браузерном режиме
  }
}

export function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'soft' | 'selection' | 'success' = 'light'
): void {
  const haptic = window.Telegram?.WebApp?.HapticFeedback;
  if (!haptic) return;
  try {
    if (type === 'selection') {
      haptic.selectionChanged?.();
    } else if (type === 'success') {
      haptic.notificationOccurred?.('success');
    } else {
      haptic.impactOccurred?.(type);
    }
  } catch {
    // Fallback silent
  }
}

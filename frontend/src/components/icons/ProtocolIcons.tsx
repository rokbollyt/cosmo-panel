import React from 'react';
import type { ProtocolType } from '../../types/vpn';
import { cn } from '../../utils/cn';

interface ProtocolIconProps {
  protocol: ProtocolType;
  className?: string;
  size?: number;
}

/**
 * Кастомные строго чёрно-белые иконки для 4 поддерживаемых протоколов панели:
 * VLESS, Hysteria2, MTProxy (Telegram), SOCKS5
 */
export const ProtocolGlyph: React.FC<ProtocolIconProps> = ({
  protocol,
  className,
  size = 22,
}) => {
  switch (protocol) {
    case 'vless':
      // Кристаллическая призма V + внутренний фазовый луч (Reality / Xray)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <path
            d="M3.5 5.5L12 20.5L20.5 5.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.1 5.5L12 12.6L15.9 5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.65"
          />
          <path
            d="M12 3.2L13.5 5.5L12 7.8L10.5 5.5L12 3.2Z"
            fill="currentColor"
          />
        </svg>
      );

    case 'hysteria2':
      // Аэродинамический двойной QUIC/UDP импульс (Hysteria2)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <path
            d="M4 15.5C6.5 9.5 11.2 6.5 19.5 5.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M4.5 19.5C8.5 14.2 13.4 11.6 20 11"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeOpacity="0.72"
          />
          <path
            d="M14.8 4.2L19.8 5.4L17.2 9.6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7.5" cy="18.2" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'mtproxy':
      // Telegram-самолёт внутри защищённого шлюзового контура (MTProxy Fake-TLS)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <path
            d="M20.4 4.8L3.7 11.1C3.1 11.33 3.12 12.18 3.74 12.38L8.65 13.95L16.8 8.35L11.2 15.15L16.35 19.05C16.86 19.44 17.6 19.17 17.75 18.55L21.18 5.65C21.31 5.14 20.89 4.62 20.4 4.8Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.65 13.95L10.1 18.75C10.22 19.12 10.69 19.22 10.95 18.92L12.95 16.55"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.78"
          />
        </svg>
      );

    case 'socks5':
      // Двухслойный сетевой шлюз-сокет (SOCKS5 TCP/UDP)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <rect
            x="3.5"
            y="4.5"
            width="10.5"
            height="10.5"
            rx="3.2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <rect
            x="10"
            y="9"
            width="10.5"
            height="10.5"
            rx="3.2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeOpacity="0.78"
          />
          <circle cx="8.75" cy="9.75" r="1.45" fill="currentColor" />
          <circle cx="15.25" cy="14.25" r="1.45" fill="currentColor" />
        </svg>
      );
  }
};

interface ProtocolBadgeProps {
  protocol: ProtocolType;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProtocolIconBadge: React.FC<ProtocolBadgeProps> = ({
  protocol,
  active = true,
  size = 'md',
  className,
}) => {
  const dims =
    size === 'sm'
      ? 'h-8 w-8 rounded-[11px]'
      : size === 'lg'
        ? 'h-12 w-12 rounded-[16px]'
        : 'h-11 w-11 rounded-[15px]';

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 23 : 20;

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center border transition-all duration-300',
        dims,
        active
          ? 'border-white/30 bg-gradient-to-br from-white/22 via-white/8 to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_16px_rgba(0,0,0,0.65)]'
          : 'border-white/10 bg-white/[0.03] text-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
        className
      )}
    >
      <ProtocolGlyph protocol={protocol} size={iconSize} />
    </div>
  );
};

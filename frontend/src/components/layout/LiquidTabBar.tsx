import React from 'react';
import { motion } from 'framer-motion';
import { Activity, KeyRound, Link2, SlidersHorizontal } from 'lucide-react';
import type { TabId } from '../../types/vpn';
import { LiquidShaderOverlay } from '../shaders/LiquidGlassSurface';
import { JELLY_SNAP, JELLY_TAP } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface LiquidTabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const TABS: {
  id: TabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Обзор', Icon: Activity },
  { id: 'keys', label: 'Ключи', Icon: KeyRound },
  { id: 'subscription', label: 'Подписка', Icon: Link2 },
  { id: 'settings', label: 'Настройки', Icon: SlidersHorizontal },
];

export const LiquidTabBar: React.FC<LiquidTabBarProps> = ({
  activeTab,
  onChange,
}) => {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
      <nav
        aria-label="Навигация панели"
        className="liquid-glass-strong pointer-events-auto relative flex w-full max-w-[402px] items-center justify-between overflow-hidden rounded-[28px] p-1.5"
      >
        {/* Живой оптический WebGL-шейдер жидкого стекла внутри дока */}
        <LiquidShaderOverlay intensity={0.95} />
        <div className="liquid-lens-sheen" aria-hidden="true" />

        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <motion.button
              key={id}
              type="button"
              whileTap={JELLY_TAP}
              onClick={() => {
                if (id === activeTab) return;
                triggerHaptic('selection');
                onChange(id);
              }}
              className="relative z-10 flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[22px] py-2.5 select-none focus:outline-none"
            >
              {isActive && (
                <motion.span
                  layoutId="liquid-nav-droplet"
                  transition={JELLY_SNAP}
                  className="liquid-droplet absolute inset-0 rounded-[22px] border border-white/35"
                />
              )}

              <motion.span
                animate={{
                  scale: isActive ? 1.08 : 1,
                  y: isActive ? -0.5 : 0,
                }}
                transition={JELLY_SNAP}
                className="relative z-10"
              >
                <Icon
                  className={`h-[19px] w-[19px] transition-colors duration-200 ${
                    isActive ? 'text-white stroke-[2.2]' : 'text-white/45 stroke-[1.8]'
                  }`}
                />
              </motion.span>

              <span
                className={`relative z-10 text-[10.5px] tracking-tight transition-colors duration-200 ${
                  isActive ? 'font-semibold text-white' : 'font-medium text-white/45'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

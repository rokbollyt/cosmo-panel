import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { LiquidGlassCard } from '../shaders/LiquidGlassSurface';
import { ProtocolIconBadge } from '../icons/ProtocolIcons';
import { JellySwitch } from '../ui/JellySwitch';
import { JellyButton } from '../ui/JellyButton';
import { PROTOCOL_META, type VpnKey } from '../../types/vpn';
import { JELLY_ITEM_VARIANTS, JELLY_SPRING } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface KeysTabProps {
  keys: VpnKey[];
  onToggleKey: (id: string, enabled: boolean) => void;
  onOpenCreate: () => void;
  onSelectKey: (key: VpnKey) => void;
}

export const KeysTab: React.FC<KeysTabProps> = ({
  keys,
  onToggleKey,
  onOpenCreate,
  onSelectKey,
}) => {
  const activeCount = keys.filter((k) => k.enabled).length;

  return (
    <div className="space-y-3.5 pb-4">
      {/* Лаконичная шапка раздела */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-[19px] font-semibold tracking-tight text-white">
            Ключи
          </h2>
          <p className="mt-0.5 text-[12px] text-white/45">
            {activeCount} из {keys.length} активно в <span className="font-mono-tech text-white/70">/sub</span>
          </p>
        </div>

        <JellyButton variant="primary" size="sm" onClick={onOpenCreate}>
          <Plus className="h-4 w-4 stroke-[2.4]" />
          <span>Создать</span>
        </JellyButton>
      </div>

      {/* Чистый список ключей: ТОЛЬКО иконка, название, протокол и свитчер */}
      {keys.length === 0 ? (
        <LiquidGlassCard className="p-8 text-center">
          <div className="text-[15px] font-medium text-white/80">
            Список ключей пуст
          </div>
          <p className="mt-1.5 text-[12.5px] text-white/45">
            Создайте первый ключ VLESS, Hysteria2, MTProxy или SOCKS5
          </p>
          <div className="mt-5 flex justify-center">
            <JellyButton variant="primary" size="md" onClick={onOpenCreate}>
              <Plus className="h-4 w-4 stroke-[2.4]" />
              <span>Создать ключ</span>
            </JellyButton>
          </div>
        </LiquidGlassCard>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false} mode="popLayout">
            {keys.map((item, idx) => {
              const meta = PROTOCOL_META[item.protocol];
              return (
                <motion.div
                  key={item.id}
                  layout
                  custom={idx}
                  variants={JELLY_ITEM_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={JELLY_SPRING}
                >
                  <LiquidGlassCard
                    interactive
                    onClick={() => {
                      triggerHaptic('light');
                      onSelectKey(item);
                    }}
                    className="px-4 py-3.5"
                  >
                    <div className="flex items-center justify-between gap-3.5">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <ProtocolIconBadge
                          protocol={item.protocol}
                          active={item.enabled}
                        />
                        <div className="min-w-0">
                          <div
                            className={`truncate text-[15px] font-medium tracking-[-0.01em] transition-colors duration-300 ${
                              item.enabled ? 'text-white' : 'text-white/45'
                            }`}
                          >
                            {item.name}
                          </div>
                          <div
                            className={`font-mono-tech mt-0.5 text-[11.5px] tracking-wide transition-colors duration-300 ${
                              item.enabled ? 'text-white/55' : 'text-white/30'
                            }`}
                          >
                            {meta.label}
                          </div>
                        </div>
                      </div>

                      <JellySwitch
                        checked={item.enabled}
                        onChange={(next) => onToggleKey(item.id, next)}
                        ariaLabel={`Переключить ключ ${item.name}`}
                      />
                    </div>
                  </LiquidGlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

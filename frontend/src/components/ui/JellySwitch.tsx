import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../../utils/haptics';
import { cn } from '../../utils/cn';

interface JellySwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
}

/**
 * Тактильный монохромный переключатель в стиле Liquid Glass + Jelly physics.
 * Капля растягивается при нажатии и пружинно перекатывается в другое состояние.
 */
export const JellySwitch: React.FC<JellySwitchProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  size = 'md',
}) => {
  const [pressing, setPressing] = useState(false);

  const trackClass = size === 'sm' ? 'h-[26px] w-[46px]' : 'h-[31px] w-[54px]';
  const knobHeight = size === 'sm' ? 20 : 24;
  const knobRestWidth = size === 'sm' ? 20 : 24;
  const knobStretchWidth = size === 'sm' ? 26 : 31;
  const travelX = size === 'sm' ? 20 : 23;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    triggerHaptic('selection');
    onChange(!checked);
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleToggle}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!disabled) setPressing(true);
      }}
      onPointerUp={() => setPressing(false)}
      onPointerLeave={() => setPressing(false)}
      onPointerCancel={() => setPressing(false)}
      whileTap={{ scaleX: 1.06, scaleY: 0.92 }}
      transition={{ type: 'spring', stiffness: 520, damping: 18 }}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-[3px] transition-colors duration-300 focus:outline-none',
        trackClass,
        checked
          ? 'bg-white/92 shadow-[inset_0_1px_2px_rgba(255,255,255,0.95),0_0_20px_rgba(255,255,255,0.22)] border border-white/80'
          : 'bg-white/[0.08] shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),inset_0_-1px_0_rgba(255,255,255,0.16)] border border-white/20',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <motion.span
        layout
        animate={{
          x: checked ? travelX - (pressing ? knobStretchWidth - knobRestWidth : 0) : 0,
          width: pressing ? knobStretchWidth : knobRestWidth,
          height: knobHeight,
          scaleY: pressing ? 0.9 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 520,
          damping: 22,
          mass: 0.72,
        }}
        className={cn(
          'block rounded-full',
          checked
            ? 'bg-black shadow-[0_2px_8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]'
            : 'bg-white/85 shadow-[0_2px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,1)]'
        )}
      />
    </motion.button>
  );
};

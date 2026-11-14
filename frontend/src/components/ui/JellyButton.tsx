import React from 'react';
import { motion } from 'framer-motion';
import { JELLY_TAP } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';
import { cn } from '../../utils/cn';

interface JellyButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'glass' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const JellyButton: React.FC<JellyButtonProps> = ({
  children,
  onClick,
  variant = 'glass',
  size = 'md',
  type = 'button',
  disabled = false,
  className,
  ariaLabel,
}) => {
  const variantStyles = {
    primary:
      'bg-white text-black font-semibold shadow-[0_8px_28px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,1)] hover:bg-white/95',
    glass:
      'liquid-glass text-white font-medium hover:bg-white/[0.11]',
    outline:
      'border border-white/22 bg-white/[0.03] text-white/90 hover:border-white/40 hover:bg-white/[0.08]',
    ghost:
      'bg-transparent text-white/75 hover:bg-white/[0.07] hover:text-white',
  };

  const sizeStyles = {
    sm: 'h-9 px-3.5 text-[13px] rounded-[14px] gap-1.5',
    md: 'h-11 px-4 text-[14px] rounded-[16px] gap-2',
    lg: 'h-[50px] px-5 text-[15px] rounded-[18px] gap-2',
    icon: 'h-10 w-10 rounded-[14px] p-0',
  };

  return (
    <motion.button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      whileTap={disabled ? undefined : JELLY_TAP}
      onClick={(e) => {
        if (disabled) return;
        triggerHaptic('light');
        onClick?.(e);
      }}
      className={cn(
        'relative inline-flex cursor-pointer items-center justify-center select-none transition-colors duration-200 focus:outline-none',
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'cursor-not-allowed opacity-40',
        className
      )}
    >
      {children}
    </motion.button>
  );
};

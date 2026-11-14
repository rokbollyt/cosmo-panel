import type { Transition, Variants } from 'framer-motion';

// ============================================================================
// JELLY PHYSICS PRESETS — ЭЛАСТИЧНЫЕ «ЖЕЛЕЙНЫЕ» АНИМАЦИИ
// Squash-and-stretch + контролируемый пружинный отскок
// ============================================================================

/** Основная желейная пружина — упругая с выраженным мягким отскоком */
export const JELLY_SPRING: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 18,
  mass: 0.9,
};

/** Быстрая пружина для свитчеров, пилюль навигации и кликов */
export const JELLY_SNAP: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 20,
  mass: 0.78,
};

/** Мягкое желейное появление модальных окон / bottom sheet */
export const JELLY_SHEET: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 22,
  mass: 1.0,
};

/** Эффект сжатия-растяжения желе при нажатии */
export const JELLY_TAP = {
  scaleX: 1.035,
  scaleY: 0.94,
  transition: { type: 'spring' as const, stiffness: 620, damping: 16 },
};

/** Лёгкий желейный тап для карточек */
export const JELLY_CARD_TAP = {
  scaleX: 1.015,
  scaleY: 0.975,
  transition: { type: 'spring' as const, stiffness: 520, damping: 18 },
};

/** Анимация переключения вкладок с лёгким упругим растяжением */
export const JELLY_TAB_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 22,
    scaleX: 0.94,
    scaleY: 1.05,
    filter: 'blur(6px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 360,
      damping: 20,
      mass: 0.88,
      opacity: { duration: 0.22 },
      filter: { duration: 0.26 },
    },
  },
  exit: {
    opacity: 0,
    y: -14,
    scaleX: 1.03,
    scaleY: 0.95,
    filter: 'blur(5px)',
    transition: {
      duration: 0.16,
      ease: [0.32, 0, 0.67, 0],
    },
  },
};

/** Желейное появление элементов списка (stagger + squash-stretch) */
export const JELLY_ITEM_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scaleX: 0.92,
    scaleY: 1.08,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    transition: {
      delay: i * 0.048,
      type: 'spring',
      stiffness: 370,
      damping: 18,
      mass: 0.86,
    },
  }),
  exit: {
    opacity: 0,
    scaleX: 1.08,
    scaleY: 0.72,
    y: -8,
    transition: { duration: 0.2 },
  },
};

import type { Variants, Transition } from "motion/react";

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const easeEnter = [0.16, 1, 0.3, 1] as const;

export const transitionFast: Transition = { duration: 0.18, ease: easeOut };
export const transitionBase: Transition = { duration: 0.26, ease: easeOut };
export const transitionReveal: Transition = { duration: 0.48, ease: easeEnter };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: transitionReveal },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionBase },
};

export const staggerContainer = (stagger = 0.06, delayChildren = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

export const menuPanel: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: transitionBase },
  exit: { opacity: 0, y: 4, transition: { duration: 0.14, ease: "easeIn" } },
};

export const cardHover = {
  y: -4,
  transition: { duration: 0.18, ease: easeOut },
};

export const press = { scale: 0.985 };

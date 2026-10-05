import type { ComponentChildren } from 'preact';

/**
 * Frame for a game's lobby illustration: a 120 × 64 SVG that scales to the card.
 * Colours come from theme variables (through `style`, since SVG attributes can't read var()),
 * so every drawing works in light and dark mode.
 */
export function ArtFrame({ children }: { children: ComponentChildren }) {
  return (
    <svg class="game-art" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Inline style for an SVG fill from a CSS colour (theme variables welcome). */
export const fill = (c: string) => ({ fill: c });

/** Inline style for an SVG stroke, round-capped. */
export const stroke = (c: string, width = 2) => ({ stroke: c, strokeWidth: width, fill: 'none', strokeLinecap: 'round' as const });

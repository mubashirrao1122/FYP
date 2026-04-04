'use client';

import React, { type ReactNode } from 'react';

interface GradientBorderProps {
  children: ReactNode;
  className?: string;
  borderWidth?: number;
  animated?: boolean;
}

/**
 * GradientBorder — Wraps content with an animated rotating conic-gradient border.
 * Uses CSS @property for --gradient-angle animation (defined in globals.css).
 * Non-animated mode renders a static shimmer gradient.
 */
export function GradientBorder({
  children,
  className = '',
  borderWidth = 1,
  animated = true,
}: GradientBorderProps) {
  return (
    <div className={`relative rounded-2xl ${className}`}>
      {/* Animated gradient border pseudo-element via CSS class */}
      <div
        className={`absolute inset-0 rounded-2xl pointer-events-none ${animated ? 'gradient-border' : ''}`}
        style={
          !animated
            ? {
                padding: `${borderWidth}px`,
                background: 'linear-gradient(135deg, #06B6D4, #3B82F6, #8B5CF6)',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                WebkitMaskComposite: 'xor',
                borderRadius: 'inherit',
              }
            : undefined
        }
      />

      {/* Content */}
      <div className="relative z-10 rounded-2xl">{children}</div>
    </div>
  );
}

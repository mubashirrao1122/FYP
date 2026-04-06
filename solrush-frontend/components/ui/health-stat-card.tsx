"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/* ── Types ──────────────────────────────────────────────── */

export interface StatItem {
  label: string
  value: number | string
  icon?: React.ReactNode
}

export interface GraphBar {
  label: string
  value: number        // percentage 0-100
  tooltip?: string
}

export interface HealthStatCardProps {
  title: string
  description?: string
  icon?: React.ReactNode
  /** Primary accent — all graph bars & stat icons derive from this single color */
  accent?: string
  stats: StatItem[]
  graphData: GraphBar[]
  className?: string
}

/* ── Component ──────────────────────────────────────────── */

export function HealthStatCard({
  title,
  description,
  icon,
  accent = '#9945FF',
  stats,
  graphData,
  className,
}: HealthStatCardProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  return (
    <div
      className={cn(
        "glass-card rounded-2xl p-5 relative overflow-hidden group",
        className,
      )}
    >
      {/* Subtle glow on hover — single accent */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 30% 20%, ${accent}08 0%, transparent 70%)` }}
      />

      {/* Header */}
      <div className="relative flex items-center gap-3 mb-4">
        {icon && (
          <div
            className="w-9 h-9 rounded-xl border border-border/20 flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}12`, color: accent }}
          >
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
          {description && (
            <p className="text-[11px] text-foreground/40 mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Stats row — values are white, icons use accent at low opacity */}
      <div className="relative grid grid-cols-2 gap-3 mb-5">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {stat.icon && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}10`, color: `${accent}99` }}
              >
                {stat.icon}
              </div>
            )}
            <div>
              <div className="text-[15px] font-bold text-foreground font-data">
                {stat.value}
              </div>
              <div className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Animated bar graph — single accent with opacity variation */}
      <TooltipProvider delayDuration={0}>
        <div className="relative flex items-end gap-1.5 h-14">
          {graphData.map((bar, i) => {
            // Create depth through opacity: tallest bar = full, shorter = dimmer
            const maxVal = Math.max(...graphData.map(b => b.value), 1)
            const intensity = 0.35 + (bar.value / maxVal) * 0.65

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <motion.div
                    className="flex-1 rounded-t-sm cursor-pointer relative"
                    style={{
                      backgroundColor: accent,
                      opacity: hoveredBar === null
                        ? intensity
                        : hoveredBar === i ? 1 : 0.15,
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(bar.value, 6)}%` }}
                    transition={{
                      height: { duration: 0.7, delay: i * 0.06, ease: "easeOut" },
                    }}
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-card border border-border/30 text-foreground text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl"
                >
                  <span className="font-semibold text-foreground">{bar.label}</span>
                  <span className="text-muted-foreground ml-1.5">
                    {bar.tooltip || `${bar.value.toFixed(0)}%`}
                  </span>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>

      {/* Legend — subdued, no colored dots */}
      <div className="relative flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {graphData.map((bar, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accent, opacity: 0.35 + (bar.value / Math.max(...graphData.map(b => b.value), 1)) * 0.65 }}
            />
            <span className="text-[10px] text-foreground/40 font-medium">
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

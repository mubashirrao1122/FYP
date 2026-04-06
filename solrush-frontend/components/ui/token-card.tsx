import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TokenCardProps {
  className?: string;
  /** URL for the token logo image. Falls back to initials if missing. */
  logoSrc?: string;
  /** Token ticker symbol (e.g. "SOL"). */
  ticker: string;
  /** Full token / project name (e.g. "Solana"). */
  name: string;
  /** Current mark price in USD. */
  price: number;
  /** Portfolio allocation percentage (0–100). Positive = gain style. */
  allocation: number;
  /** Token balance held. */
  balance: number;
  /** Total value in USD. */
  valueUSD: number;
  /** Called when the user clicks "Trade". */
  onTrade?: (ticker: string) => void;
}

const TokenCard = React.forwardRef<HTMLDivElement, TokenCardProps>(
  (
    {
      className,
      logoSrc,
      ticker,
      name,
      price,
      allocation,
      balance,
      valueUSD,
      onTrade,
    },
    ref,
  ) => {
    const isPositive = allocation >= 0;

    const formattedPrice = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

    const formattedValue = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valueUSD);

    const formattedAllocation = `${Math.abs(allocation).toFixed(2)}%`;

    return (
      <motion.div
        ref={ref}
        whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        className={cn(
          "flex items-center justify-between w-full p-4",
          "glass-card rounded-xl",
          "shadow-sm transition-shadow hover:shadow-lg hover:shadow-neon-cyan/5",
          className,
        )}
      >
        {/* Left: Logo + Ticker */}
        <div className="flex items-center gap-3 min-w-0">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={`${ticker} logo`}
              className="h-10 w-10 rounded-full border border-border/20 shadow-md shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted border border-border/20 flex items-center justify-center text-[11px] font-bold text-foreground/60 shrink-0">
              {ticker.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-[15px] text-foreground truncate">{ticker}</p>
            <p className="text-[12px] text-muted-foreground truncate">{name}</p>
          </div>
        </div>

        {/* Center: Price + Allocation */}
        <div className="text-right hidden sm:block">
          <p className="font-semibold text-[15px] text-foreground font-data">
            {formattedPrice}
          </p>
          <div className="flex items-center justify-end gap-1">
            {isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-neon-green" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
            )}
            <span
              className={cn(
                "text-[12px] font-semibold",
                isPositive ? "text-neon-green" : "text-destructive",
              )}
            >
              {formattedAllocation}
            </span>
          </div>
        </div>

        {/* Right: Value + Trade */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-bold text-[15px] text-foreground font-data">
              {formattedValue}
            </p>
            <p className="text-[11px] text-muted-foreground font-data">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
              {ticker}
            </p>
          </div>
          {onTrade && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onTrade(ticker)}
              aria-label={`Trade ${ticker}`}
              className="bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25 hover:bg-neon-cyan/25 hover:text-foreground font-bold text-[11px] tracking-wider"
            >
              Trade
            </Button>
          )}
        </div>
      </motion.div>
    );
  },
);

TokenCard.displayName = "TokenCard";

export { TokenCard };
export type { TokenCardProps };

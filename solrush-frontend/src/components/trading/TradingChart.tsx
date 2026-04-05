'use client';

import { useEffect, useRef } from 'react';

interface TradingChartProps {
  tokenPair: string;
  inputToken: string;
  outputToken: string;
}

/**
 * TradingChart — lightweight price chart stub.
 * Replace with TradingView widget or recharts integration once pairs have OHLCV data.
 */
export function TradingChart({ tokenPair, inputToken, outputToken }: TradingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw a simple demo price line
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 300;
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, 'rgba(153, 69, 255, 0.05)');
    bg.addColorStop(1, 'rgba(0, 255, 194, 0.02)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Simulated price line (pseudo-random but stable per pair)
    const seed = tokenPair.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const points: [number, number][] = [];
    let price = 0.4 + (seed % 30) / 100;
    const steps = 60;

    for (let i = 0; i < steps; i++) {
      const noise = Math.sin(i * 0.4 + seed) * 0.03 + Math.cos(i * 0.2 + seed * 0.1) * 0.02;
      price = Math.max(0.05, Math.min(0.95, price + noise));
      points.push([(i / (steps - 1)) * width, (1 - price) * height]);
    }

    // Area fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 255, 194, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 255, 194, 0.00)');
    ctx.beginPath();
    ctx.moveTo(points[0][0], height);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Price line
    ctx.beginPath();
    ctx.strokeStyle = '#00FFC2';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.fillText(`${tokenPair} · Localnet`, 12, 18);
  }, [tokenPair]);

  return (
    <div className="w-full h-[300px] rounded-xl overflow-hidden relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute bottom-3 right-3 text-[10px] text-foreground/25 font-mono">
        localnet demo chart
      </div>
    </div>
  );
}


import { FC, useMemo } from 'react';

// Price level in the order book
interface OrderLevel {
    price: number;
    size: number;
    total: number;
}

interface OrderBookProps {
    currentPrice: number;
    depth?: number;
}

export const OrderBook: FC<OrderBookProps> = ({ currentPrice, depth = 12 }) => {
    // Generate mock order book data based on current price
    const { asks, bids } = useMemo(() => {
        const askData: OrderLevel[] = [];
        const bidData: OrderLevel[] = [];

        // Generate asks (sell orders) - prices above current
        let currentTotal = 0;
        for (let i = 0; i < depth; i++) {
            const price = currentPrice * (1 + (i + 1) * 0.0005 + Math.random() * 0.001);
            const size = Math.random() * 100 + 10;
            currentTotal += size;
            askData.push({
                price,
                size,
                total: currentTotal
            });
        }

        // Generate bids (buy orders) - prices below current
        currentTotal = 0;
        for (let i = 0; i < depth; i++) {
            const price = currentPrice * (1 - (i + 1) * 0.0005 - Math.random() * 0.001);
            const size = Math.random() * 100 + 10;
            currentTotal += size;
            bidData.push({
                price,
                size,
                total: currentTotal
            });
        }

        return { asks: askData.reverse(), bids: bidData };
    }, [currentPrice, depth]);

    const maxTotal = Math.max(
        asks[0]?.total || 0,
        bids[bids.length - 1]?.total || 0
    );

    return (
        <div className="flex flex-col h-full bg-[#0F172A] border-r border-[#1F2937]">
            <div className="p-3 border-b border-[#1F2937]">
                <h3 className="text-sm font-semibold text-[#E5E7EB]">Order Book</h3>
            </div>

            {/* Asks (Sells) - Red */}
            <div className="flex-1 overflow-hidden flex flex-col justify-end">
                {asks.map((level, i) => (
                    <div key={`ask-${i}`} className="flex text-xs relative group cursor-pointer hover:bg-[#1F2937]">
                        <div
                            className="absolute top-0 right-0 h-full bg-[#EF4444]/10 transition-all duration-200"
                            style={{ width: `${(level.total / maxTotal) * 100}%` }}
                        />
                        <div className="flex-1 px-3 py-0.5 z-10 text-[#EF4444] font-medium text-left">
                            {level.price.toFixed(2)}
                        </div>
                        <div className="flex-1 px-3 py-0.5 z-10 text-[#9CA3AF] text-right">
                            {level.size.toFixed(2)}
                        </div>
                        <div className="flex-1 px-3 py-0.5 z-10 text-[#6B7280] text-right hidden lg:block">
                            {level.total.toFixed(0)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Spread & Current Price */}
            <div className="py-2 px-3 border-y border-[#1F2937] flex items-center justify-between bg-[#1F2937]/30">
                <span className={`text-lg font-bold ${currentPrice ? 'text-[#22C55E]' : 'text-[#E5E7EB]'}`}>
                    {currentPrice.toFixed(2)}
                </span>
                <span className="text-xs text-[#9CA3AF]">
                    Last Price
                </span>
            </div>

            {/* Bids (Buys) - Green */}
            <div className="flex-1 overflow-hidden">
                {bids.map((level, i) => (
                    <div key={`bid-${i}`} className="flex text-xs relative group cursor-pointer hover:bg-[#1F2937]">
                        <div
                            className="absolute top-0 right-0 h-full bg-[#22C55E]/10 transition-all duration-200"
                            style={{ width: `${(level.total / maxTotal) * 100}%` }}
                        />
                        <div className="flex-1 px-3 py-0.5 z-10 text-[#22C55E] font-medium text-left">
                            {level.price.toFixed(2)}
                        </div>
                        <div className="flex-1 px-3 py-0.5 z-10 text-[#9CA3AF] text-right">
                            {level.size.toFixed(2)}
                        </div>
                        <div className="flex-1 px-3 py-0.5 z-10 text-[#6B7280] text-right hidden lg:block">
                            {level.total.toFixed(0)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

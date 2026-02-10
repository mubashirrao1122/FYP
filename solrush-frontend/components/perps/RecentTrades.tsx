
import { FC, useMemo } from 'react';
import { format } from 'date-fns';

export interface Trade {
    id: string;
    price: number;
    size: number;
    time: number;
    side: 'buy' | 'sell';
}

interface RecentTradesProps {
    currentPrice: number;
    trades: Trade[];
}

export const RecentTrades: FC<RecentTradesProps> = ({ currentPrice, trades }) => {

    return (
        <div className="bg-[#0F172A] border-r border-[#1F2937] h-full flex flex-col">
            <div className="p-3 border-b border-[#1F2937]">
                <h3 className="text-sm font-semibold text-[#E5E7EB]">Recent Trades</h3>
            </div>

            <div className="flex text-xs text-[#6B7280] px-3 py-2 border-b border-[#1F2937]/50">
                <div className="flex-1">Price</div>
                <div className="flex-1 text-right">Size</div>
                <div className="flex-1 text-right">Time</div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                {trades.map((trade) => (
                    <div key={trade.id} className="flex text-xs px-3 py-1 hover:bg-[#1F2937] cursor-default transition-colors">
                        <div className={`flex-1 font-medium ${trade.side === 'buy' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                            {trade.price.toFixed(2)}
                        </div>
                        <div className="flex-1 text-right text-[#E5E7EB]">
                            {trade.size.toFixed(4)}
                        </div>
                        <div className="flex-1 text-right text-[#9CA3AF]">
                            {format(trade.time, 'HH:mm:ss')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

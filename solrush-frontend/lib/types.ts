export interface LimitOrder {
    id: string;
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    targetPrice: number;
    status: 'pending' | 'executed' | 'cancelled';
    expiresAt: Date;
    createdAt: Date;
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PythPrice } from '@/lib/perps/types';
import { subscribePrice } from '@/lib/perps/pyth';

interface UsePythPriceResult {
  price: PythPrice | null;
  loading: boolean;
  error: string | null;
}

export const usePythPrice = (feedId?: string | null): UsePythPriceResult => {
  const [price, setPrice] = useState<PythPrice | null>(null);
  const [loading, setLoading] = useState(Boolean(feedId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!feedId) {
      setPrice(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribePrice(
      feedId,
      (data) => {
        setPrice(data);
        setLoading(false);
        setError(null);
      },
      {
        onError: (err) => {
          setError(err.message);
          setLoading(false);
        },
      }
    );

    return () => {
      unsubscribe();
    };
  }, [feedId]);

  return useMemo(() => ({ price, loading, error }), [price, loading, error]);
};

import { useState, useEffect } from 'react';

export const useRewards = (userId: string | null) => {
  const [loading, setLoading] = useState(false);
  const [claimable, setClaimable] = useState(0);
  const [totalRush, setTotalRush] = useState(0);
  const [claimed, setClaimed] = useState(0);

  useEffect(() => {
    if (userId) {
      // Mock data fetching
      setClaimable(150.5);
      setTotalRush(500.0);
      setClaimed(349.5);
    } else {
      setClaimable(0);
      setTotalRush(0);
      setClaimed(0);
    }
  }, [userId]);

  const claimRewards = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Mock claim delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setClaimed((prev) => prev + claimable);
      setClaimable(0);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    claimable,
    totalRush,
    claimed,
    claimRewards,
  };
};

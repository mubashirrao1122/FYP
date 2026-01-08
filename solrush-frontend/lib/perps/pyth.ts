import { z } from 'zod';
import type { PythPrice } from '@/lib/perps/types';

const DEFAULT_HERMES = 'https://hermes.pyth.network';
const CACHE_TTL_MS = 700;

const normalizeId = (id: string) => {
  if (!id) return '';
  return id.startsWith('0x') ? id : `0x${id}`;
};

const toNumber = (value: string | number) => {
  if (typeof value === 'number') return value;
  return Number(value);
};

const toPrice = (price: string | number, expo: number) => {
  return toNumber(price) * Math.pow(10, expo);
};

const HermesPriceFeedSchema = z.object({
  id: z.string(),
  price: z.object({
    price: z.union([z.string(), z.number()]),
    conf: z.union([z.string(), z.number()]),
    expo: z.number(),
    publish_time: z.number(),
  }),
});

const HermesPriceResponseSchema = z.array(HermesPriceFeedSchema);

type HermesPriceFeed = z.infer<typeof HermesPriceFeedSchema>;

export const parseHermesPriceFeed = (feed: HermesPriceFeed): PythPrice | null => {
  if (!feed?.price) return null;
  const expo = feed.price.expo ?? 0;
  return {
    price: toPrice(feed.price.price, expo),
    confidence: toPrice(feed.price.conf, expo),
    expo,
    publishTime: feed.price.publish_time,
  };
};

const cache = new Map<string, { data: PythPrice; ts: number }>();
const inflight = new Map<string, Promise<PythPrice>>();

const fetchHermesPrices = async (ids: string[]): Promise<Record<string, PythPrice>> => {
  const uniqueIds = Array.from(new Set(ids.map(normalizeId))).filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const url = new URL('/api/latest_price_feeds', process.env.NEXT_PUBLIC_PYTH_HERMES_URL || DEFAULT_HERMES);
  uniqueIds.forEach((id) => url.searchParams.append('ids[]', id));

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Pyth Hermes error: ${response.status}`);
  }

  const parsed = HermesPriceResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Invalid Hermes response.');
  }
  const data = parsed.data;
  const map: Record<string, PythPrice> = {};

  data.forEach((feed) => {
    const parsed = parseHermesPriceFeed(feed);
    if (!parsed) return;
    map[normalizeId(feed.id)] = parsed;
  });

  return map;
};

export const fetchPythPrices = async (ids: string[]): Promise<Record<string, PythPrice>> => {
  const uniqueIds = Array.from(new Set(ids.map(normalizeId))).filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const result: Record<string, PythPrice> = {};
  const now = Date.now();
  const missing: string[] = [];

  uniqueIds.forEach((id) => {
    const cached = cache.get(id);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      result[id] = cached.data;
    } else {
      missing.push(id);
    }
  });

  if (missing.length > 0) {
    const fresh = await fetchHermesPrices(missing);
    Object.entries(fresh).forEach(([id, data]) => {
      cache.set(id, { data, ts: Date.now() });
      result[id] = data;
    });
  }

  return result;
};

export const getLatestPrice = async (id: string): Promise<PythPrice> => {
  const normalized = normalizeId(id);
  if (!normalized) {
    throw new Error('Missing Pyth price id.');
  }
  const now = Date.now();
  const cached = cache.get(normalized);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const existing = inflight.get(normalized);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const [price] = Object.values(await fetchHermesPrices([normalized]));
    if (!price) {
      throw new Error('Pyth Hermes returned no price.');
    }
    cache.set(normalized, { data: price, ts: Date.now() });
    return price;
  })();

  inflight.set(normalized, request);
  try {
    return await request;
  } finally {
    inflight.delete(normalized);
  }
};

interface SubscribeOptions {
  intervalMs?: number;
  maxIntervalMs?: number;
}

export const subscribePrice = (
  id: string,
  onUpdate: (price: PythPrice) => void,
  options: SubscribeOptions & { onError?: (error: Error) => void } = {}
) => {
  let active = true;
  let delay = options.intervalMs ?? 800;
  const maxDelay = options.maxIntervalMs ?? 8000;

  const poll = async () => {
    if (!active) return;
    try {
      const price = await getLatestPrice(id);
      onUpdate(price);
      delay = options.intervalMs ?? 800;
    } catch {
      delay = Math.min(delay * 1.6, maxDelay);
      if (options.onError) {
        options.onError(new Error('Failed to fetch Pyth price.'));
      }
    }
    if (!active) return;
    setTimeout(poll, delay);
  };

  poll();
  return () => {
    active = false;
  };
};

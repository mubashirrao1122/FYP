import { PublicKey, type Connection } from '@solana/web3.js';
import { Program, AnchorProvider, type Idl } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { PROGRAM_ID, SOL_MINT, USDC_MINT, USDT_MINT, WETH_MINT, RUSH_MINT } from '@/lib/solana/constants';

const PERPS_MARKET_LEN_V1 = 8 + 32 + 32 + 32 + 32 + 2 + 2 + 8 + 16 + 16 + 8 + 32 + 1;

const bnToNumber = (value: BN) => {
  const max = new BN(Number.MAX_SAFE_INTEGER.toString());
  if (value.gt(max)) return Number.MAX_SAFE_INTEGER;
  if (value.lt(max.neg())) return Number.MIN_SAFE_INTEGER;
  return value.toNumber();
};

const mintToSymbol = new Map<string, string>([
  [SOL_MINT.toBase58(), 'SOL'],
  [USDC_MINT.toBase58(), 'USDC'],
  [USDT_MINT.toBase58(), 'USDT'],
  [WETH_MINT.toBase58(), 'WETH'],
  [RUSH_MINT.toBase58(), 'RUSH'],
]);

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export interface RawPerpsMarket {
  id: string;
  baseMint: string;
  quoteMint: string;
  oraclePriceId?: string | null;
  oraclePriceAccount?: string | null;
  markPrice: number;
  fundingRateBps: number;
  openInterest: number;
  cumulativeFunding: number;
  lastFundingTs: number;
  maxLeverage?: number | null;
  maintenanceMarginBps?: number | null;
}

export interface RawPerpsPosition {
  id: string;
  owner: string;
  market: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  collateral: number;
  leverage: number;
}

export const resolveSymbol = (mint: string) => mintToSymbol.get(mint) ?? 'UNKNOWN';

const CACHE_TTL_MS = 8000;
const marketCache = new Map<string, { data: RawPerpsMarket; ts: number }>();
const positionCache = new Map<string, { data: RawPerpsPosition; ts: number }>();

interface PaginatedOptions {
  offset?: number;
  limit?: number;
  forceRefresh?: boolean;
}

export const fetchPerpsMarketExists = async (connection: Connection): Promise<boolean> => {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: PERPS_MARKET_LEN_V1 }],
    dataSlice: { offset: 0, length: 0 },
  });
  return accounts.length > 0;
};

const getReadOnlyProgram = (connection: Connection, idl: Idl): Program => {
  const readOnlyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error('Read-only');
    },
    signAllTransactions: async () => {
      throw new Error('Read-only');
    },
  };
  const provider = new AnchorProvider(connection, readOnlyWallet as any, {
    commitment: 'confirmed',
  });
  return new Program(idl, PROGRAM_ID, provider);
};

export const fetchPerpsMarkets = async (
  connection: Connection,
  idl: Idl,
  options: PaginatedOptions = {}
): Promise<RawPerpsMarket[]> => {
  const program = getReadOnlyProgram(connection, idl);
  const now = Date.now();
  const records = await program.account.perpsMarket.all();
  const offset = options.offset ?? 0;
  const limit = options.limit ?? records.length;
  const paged = records.slice(offset, offset + limit);

  return paged.map(({ publicKey, account }) => {
    const cached = marketCache.get(publicKey.toBase58());
    if (cached && !options.forceRefresh && now - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }
    const parsed: RawPerpsMarket = {
      id: publicKey.toBase58(),
      baseMint: account.baseMint.toBase58(),
      quoteMint: account.quoteMint.toBase58(),
      oraclePriceId: `0x${bytesToHex(Uint8Array.from(account.pythFeedId))}`,
      oraclePriceAccount: account.oraclePriceAccount.toBase58(),
      markPrice: 0,
      fundingRateBps: bnToNumber(account.fundingRateI64 as unknown as BN),
      openInterest: bnToNumber(account.openInterestI128 as unknown as BN),
      cumulativeFunding: bnToNumber(account.cumulativeFundingI128 as unknown as BN),
      lastFundingTs: bnToNumber(account.lastFundingTs as unknown as BN),
      maxLeverage: account.maxLeverage,
      maintenanceMarginBps: account.maintenanceMarginBps,
    };
    marketCache.set(publicKey.toBase58(), { data: parsed, ts: Date.now() });
    return parsed;
  });
};

export const fetchPerpsPositions = async (
  connection: Connection,
  owner: PublicKey,
  markets: PublicKey[],
  idl: Idl,
  options: PaginatedOptions = {}
): Promise<RawPerpsPosition[]> => {
  if (markets.length === 0) return [];
  const positionKeys = markets.map((market) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('perps_position'), owner.toBuffer(), market.toBuffer()],
      PROGRAM_ID
    )[0]
  );
  const offset = options.offset ?? 0;
  const limit = options.limit ?? positionKeys.length;
  const pagedKeys = positionKeys.slice(offset, offset + limit);

  const now = Date.now();
  const fresh = new Map<string, RawPerpsPosition>();
  const missing: PublicKey[] = [];

  pagedKeys.forEach((key) => {
    const cached = positionCache.get(key.toBase58());
    if (cached && !options.forceRefresh && now - cached.ts < CACHE_TTL_MS) {
      fresh.set(key.toBase58(), cached.data);
    } else {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    const program = getReadOnlyProgram(connection, idl);
    await Promise.all(
      missing.map(async (key) => {
        try {
          const account = await program.account.perpsPosition.fetchNullable(key);
          if (!account) return;
          const parsed: RawPerpsPosition = {
            id: key.toBase58(),
            owner: account.owner.toBase58(),
            market: account.market.toBase58(),
            side: account.side === 0 ? 'long' : 'short',
            size: bnToNumber(account.sizeI64 as unknown as BN),
            entryPrice: bnToNumber(account.entryPriceI64 as unknown as BN),
            collateral: bnToNumber(account.collateralU64 as unknown as BN),
            leverage: account.leverageU16,
          };
          positionCache.set(key.toBase58(), { data: parsed, ts: Date.now() });
          fresh.set(key.toBase58(), parsed);
        } catch {
          return;
        }
      })
    );
  }

  return pagedKeys.map((key) => fresh.get(key.toBase58())).filter(Boolean) as RawPerpsPosition[];
};

import { markets } from './trading.ts';

export const marketIntervals: Record<string, string> = {'1m':'1min','5m':'5min','15m':'15min','30m':'30min','1h':'1h','4h':'4h','1D':'1day','1W':'1week'};
export class MarketRequestError extends Error {status = 400;}
export function validateMarketHistory(symbol: string, interval: string, provider?: string) {
  if (!markets.some(m => m.symbol === symbol) || !Object.hasOwn(marketIntervals, interval)) throw new MarketRequestError('Unsupported instrument or interval.');
  if (provider === 'frankfurter' && interval !== '1D') throw new MarketRequestError('Daily reference rates support the 1D line chart only.');
  return symbol + ':' + interval;
}

export function createMarketCache(now = () => Date.now()) {
  const entries = new Map<string, {expires: number; result: Promise<unknown>}>();
  return {
    clear() {entries.clear();},
    get<T>(key: string, run: () => Promise<T>): Promise<T> {
      if (key !== 'snapshot') {
        const [symbol, interval, ...extra] = key.split(':');
        if (extra.length) throw new MarketRequestError('Invalid market-data cache key.');
        validateMarketHistory(symbol, interval);
      }
      const cached = entries.get(key);
      if (cached && cached.expires > now()) return cached.result as Promise<T>;
      // Only 57 allowlisted keys can enter: one snapshot and seven pairs x eight intervals.
      // Remove expired entries; invalid requests never enter or evict a valid result.
      for (const [entryKey, entry] of entries) if (entry.expires <= now()) entries.delete(entryKey);
      const result = Promise.resolve().then(run).catch(error => {
        if (entries.get(key)?.result === result) entries.delete(key);
        throw error;
      });
      entries.set(key, {expires: now() + 60000, result});
      return result;
    },
  };
}

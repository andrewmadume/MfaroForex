import { market, type Order } from './trading.ts';

export function objectInput(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new Error('Invalid request structure or unexpected fields.');
  }
  return value as Record<string, unknown>;
}

export function parseOrder(value: unknown): Order {
  const input = objectInput(value, ['symbol', 'side', 'lots', 'type', 'entry', 'sl', 'tp', 'key']);
  if (typeof input.symbol !== 'string' || typeof input.side !== 'string' || typeof input.type !== 'string' ||
      typeof input.key !== 'string' || typeof input.lots !== 'number') throw new Error('Invalid order fields.');
  const instrument = market(input.symbol);
  if (input.side !== 'buy' && input.side !== 'sell') throw new Error('Invalid order direction.');
  const optional: {entry?: number; sl?: number; tp?: number} = {};
  for (const key of ['entry', 'sl', 'tp'] as const) {
    const number = input[key];
    if (number !== undefined) {
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error('Invalid order prices.');
      optional[key] = number;
    }
  }
  return {symbol: instrument.symbol, side: input.side, lots: input.lots, type: input.type, key: input.key, ...optional};
}

export type TerminalRequest =
  | {action: 'order'; order: Order}
  | {action: 'close'; id: string}
  | {action: 'modify'; id: string; sl?: number; tp?: number}
  | {action: 'watchlist'; symbols: string[]}
  | {action: 'preferences'; currency: string; theme: string; notifications: boolean};

export function parseTerminalRequest(value: unknown): TerminalRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request structure.');
  const action = (value as Record<string, unknown>).action;
  if (action === 'order') {
    const input = objectInput(value, ['action', 'order']);
    return {action, order: parseOrder(input.order)};
  }
  if (action === 'close' || action === 'modify') {
    const input = objectInput(value, action === 'close' ? ['action', 'id'] : ['action', 'id', 'sl', 'tp']);
    if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error('Invalid position identifier.');
    if (action === 'close') return {action, id: input.id};
    const levels: {sl?: number; tp?: number} = {};
    for (const key of ['sl', 'tp'] as const) if (input[key] !== undefined) {
      if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] <= 0) throw new Error('Invalid protective levels.');
      levels[key] = input[key];
    }
    return {action, id: input.id, ...levels};
  }
  if (action === 'watchlist') {
    const input = objectInput(value, ['action', 'symbols']);
    if (!Array.isArray(input.symbols) || input.symbols.length > 7 || input.symbols.some(symbol => typeof symbol !== 'string')) throw new Error('Invalid watchlist.');
    return {action, symbols: [...new Set(input.symbols.map(symbol => market(symbol).symbol))]};
  }
  if (action === 'preferences') {
    const input = objectInput(value, ['action', 'currency', 'theme', 'notifications']);
    if (typeof input.currency !== 'string' || !['ZAR', 'USD', 'EUR'].includes(input.currency) ||
        typeof input.theme !== 'string' || !['dark', 'light'].includes(input.theme) || typeof input.notifications !== 'boolean') throw new Error('Invalid preferences.');
    return {action, currency: input.currency, theme: input.theme, notifications: input.notifications};
  }
  throw new Error('Unknown operation.');
}

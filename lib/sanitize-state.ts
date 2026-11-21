import type { State, Position } from './trading.ts';

// Old demo ledgers may contain extra fields accepted before strict validation.
// Never send client-injected result fields on an open/pending position to React.
export function sanitizeAccountState(state: State): State {
  return {...state, positions: state.positions.map(position => {
    const {symbol, side, lots, type, key, entry, sl, tp, id, price, opened, status} = position;
    const clean: Position = {symbol, side, lots, type, key, id, price, opened, status,
      ...(Number.isFinite(entry) ? {entry} : {}), ...(Number.isFinite(sl) ? {sl} : {}), ...(Number.isFinite(tp) ? {tp} : {})};
    if (status === 'closed') {
      if (typeof position.closed === 'string') clean.closed = position.closed;
      if (Number.isFinite(position.exit)) clean.exit = position.exit;
      if (Number.isFinite(position.pnl)) clean.pnl = position.pnl;
    }
    return clean;
  })};
}

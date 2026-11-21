import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync, type SQLInputValue} from 'node:sqlite';
import {DemoBroker, initialState, price, type Order, type Position} from '../lib/trading.ts';
import {parseTerminalRequest} from '../lib/request-validation.ts';
import {sanitizeAccountState} from '../lib/sanitize-state.ts';
import {createMarketCache, validateMarketHistory} from '../lib/market-cache.ts';
import {createActiveSession, activeSession, revokeSession} from '../lib/active-sessions.ts';
import {reserveMarketCredits} from '../lib/security-store.ts';
import {securityHeaders} from '../lib/security-headers.ts';
import type {Database, DatabaseStatement} from '../lib/database.ts';

function database(): Database {
  const db = new DatabaseSync(':memory:');
  return {prepare(sql: string) {
    function statement(params: SQLInputValue[] = []): DatabaseStatement {
      return {bind: (...values) => statement(values as SQLInputValue[]),
        async first<T>() {return (db.prepare(sql).get(...params) as T | undefined) ?? null;},
        async run() {return {meta: {changes: Number(db.prepare(sql).run(...params).changes)}};},
      };
    }
    return statement();
  }};
}
const order = (): Order => ({symbol:'EUR/USD',side:'buy',lots:.01,type:'Market',key:crypto.randomUUID()});

test('unexpected order fields are rejected before ledger mutation', () => {
  for (const extra of [{pnl:999999999}, {exit:{invalid:true}}, {status:'closed'}, {balance:1e9}]) {
    const state = initialState();
    assert.throws(() => new DemoBroker().submit(state, {...order(), ...extra}));
    assert.equal(state.positions.length, 0);
    assert.equal(state.balance, 100000);
  }
  assert.throws(() => parseTerminalRequest({action:'order', order:order(), admin:true}));
  for (const input of [null, [], {}, {action:'modify',id:crypto.randomUUID(),sl:'1'}, {action:'close',id:123}]) {
    assert.throws(() => parseTerminalRequest(input));
  }
});

test('legacy open-position metadata cannot crash prices or forge displayed results', () => {
  const state=initialState();
  new DemoBroker().submit(state, order());
  state.positions[0]={...state.positions[0],pnl:999999999,exit:{invalid:true}} as unknown as Position;
  const clean=sanitizeAccountState(state).positions[0];
  assert.equal(clean.pnl,undefined);
  assert.equal(clean.exit,undefined);
  assert.doesNotThrow(()=>price(clean.exit??clean.price,clean.symbol));
});

test('invalid history keys cannot evict valid cached results or call a provider', async () => {
  const cache=createMarketCache();let calls=0;
  const request=async()=>++calls;
  assert.equal(await cache.get('EUR/USD:1D',request),1);
  for(let i=0;i<128;i++)assert.throws(()=>cache.get('INVALID'+i+':1D',request));
  assert.throws(()=>validateMarketHistory('EUR/USD','toString'));
  assert.throws(()=>validateMarketHistory('EUR/USD','1m','frankfurter'));
  assert.equal(await cache.get('EUR/USD:1D',request),1);
  assert.equal(calls,1);
});

test('cache deduplicates concurrent requests and removes failures', async () => {
  let now=1000,calls=0;const cache=createMarketCache(()=>now);
  const request=async()=>++calls;
  assert.deepEqual(await Promise.all([cache.get('snapshot',request),cache.get('snapshot',request)]),[1,1]);
  now+=60001;assert.equal(await cache.get('snapshot',request),2);
  await assert.rejects(cache.get('GBP/USD:1D',async()=>{throw new Error('provider unavailable');}));
  assert.equal(await cache.get('GBP/USD:1D',request),3);
});

test('shared provider credits are atomic, bounded and reset each minute', async () => {
  const db=database();
  assert.equal(await reserveMarketCredits(db,'twelvedata',7,8,60000),true);
  const results=await Promise.all([reserveMarketCredits(db,'twelvedata',1,8,60000),reserveMarketCredits(db,'twelvedata',1,8,60000)]);
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(await reserveMarketCredits(db,'twelvedata',1,8,60000),false);
  assert.equal(await reserveMarketCredits(db,'twelvedata',7,8,120000),true);
});

test('logout revokes a copied session and database failures fail closed', async () => {
  const db=database(),secret='test-only-secret-0123456789abcdef0123456789';
  const user={userId:'github:1',email:'test@example.invalid',displayName:'Test',fullName:null};
  const now=1700000000000;
  const token=await createActiveSession(user,secret,db,now);
  assert.deepEqual(await activeSession(token,secret,db,now),user);
  assert.equal(await activeSession(token,secret,db,now+28801000),null);
  await revokeSession(token,secret,db,now);
  assert.equal(await activeSession(token,secret,db,now),null);
  assert.equal(await activeSession(token,secret,undefined,now),null);
});

test('headers deny framing on Vercel while preserving trusted Sites embedding', () => {
  const native=securityHeaders();
  assert.match(native['Content-Security-Policy'],/frame-ancestors 'none'/);
  assert.equal(native['X-Frame-Options'],'DENY');
  assert.equal(native['X-Content-Type-Options'],'nosniff');
  assert.ok(!native['Content-Security-Policy'].includes('unsafe-eval'));
  const embedded=securityHeaders(true);
  assert.match(embedded['Content-Security-Policy'],/https:\/\/chatgpt.com/);
  assert.equal(embedded['X-Frame-Options'],undefined);
});

 test('canonical origins survive proxy normalization and reject cross-site requests',async()=>{
 const {validRequestOrigin}=await import('../lib/request-origin.ts');
 const request=(origin:string)=>new Request('http://localhost:3100/api/terminal',{headers:{origin}});
 assert.equal(validRequestOrigin(request('https://app.example'),'https://app.example'),true);
 assert.equal(validRequestOrigin(request('https://evil.example'),'https://app.example'),false);
 assert.equal(validRequestOrigin(request('null'),'https://app.example'),false);
 assert.equal(validRequestOrigin(request('https://evil.example'),'invalid'),false);
 });

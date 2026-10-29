import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:3100';
const r=await fetch(origin+'/api/markets');const s=await r.json();assert.equal(r.status,200,JSON.stringify(s));assert.equal(s.provider,'frankfurter-ecb');assert.equal(s.cadence,'daily-reference');assert.equal(s.quotes.length,7);assert.ok(s.quotes.every(q=>Number.isFinite(q.last)&&q.last>0&&/^\d{4}-\d{2}-\d{2}$/.test(q.asOf)));assert.deepEqual(s.intervals,['1D']);assert.match(s.notice,/Not real-time/);
const history=await fetch(origin+'/api/markets/history?symbol=USD%2FZAR&interval=1D').then(r=>r.json());assert.equal(history.kind,'line');assert.ok(history.bars.length>20);assert.ok(history.bars.every(b=>b.open===undefined&&b.volume===undefined));assert.equal(history.bars.at(-1).close,s.quotes.find(q=>q.symbol==='USD/ZAR').last);
const invalid=await fetch(origin+'/api/markets/history?symbol=USD%2FZAR&interval=1m');assert.equal(invalid.status,400);
const health=await fetch(origin+'/api/health').then(r=>r.json());assert.equal(health.liveExecutionEnabled,false);
console.log(JSON.stringify({result:'PASS real published feed and historical observations; intraday reference request rejected; real execution disabled',provider:s.provider,asOf:s.quotes[0].asOf,pairs:s.quotes.length,historyPoints:history.bars.length,usdZar:s.quotes.find(q=>q.symbol==='USD/ZAR').last}));

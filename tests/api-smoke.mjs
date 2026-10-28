import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
const response=await fetch(origin+'/api/terminal');assert.equal(response.status,401,'Anonymous private account access must fail');assert.match(response.headers.get('cache-control'),/no-store/);
const spoof=await fetch(origin+'/api/terminal',{headers:{'oai-authenticated-user-id':'attacker','oai-authenticated-user-email':'attacker@example.invalid'}});assert.equal(spoof.status,401,'Spoofed identity headers must not authenticate');
const csrf=await fetch(origin+'/api/terminal',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://untrusted.invalid'},body:JSON.stringify({action:'order'})});assert.equal(csrf.status,403);
const json=await fetch(origin+'/api/terminal',{method:'POST',headers:{'Content-Type':'text/plain','Origin':origin},body:'hello'});assert.equal(json.status,415);
const health=await fetch(origin+'/api/health').then(r=>r.json());assert.equal(health.liveExecutionEnabled,false);
// Local development's explicit identity emulator only. Never use on hosted domains.
assert.match(new URL(origin).hostname,/^(localhost|127\.0\.0\.1)$/);
const login=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.ok(cookie,'Local authentication emulator must issue a session cookie');
const get=async()=>{const r=await fetch(origin+'/api/terminal',{headers:{Cookie:cookie}});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d.state;};
const post=async(data)=>{const r=await fetch(origin+'/api/terminal',{method:'POST',headers:{'Content-Type':'application/json','Origin':origin,Cookie:cookie},body:JSON.stringify(data)});return {status:r.status,...await r.json()};};
const malformed=await post({action:'order'});assert.equal(malformed.status,400);
const huge=await post({action:'order',payload:'x'.repeat(21000)});assert.equal(huge.status,413);
let s=await get();const before=s.positions.length;const key=crypto.randomUUID();const order={symbol:'EUR/USD',side:'buy',type:'Market',lots:.01,key};
const invalid=await post({action:'order',order:{...order,lots:1000}});assert.equal(invalid.status,400);s=await get();assert.equal(s.positions.length,before);
const a=await post({action:'order',order});assert.equal(a.status,200,JSON.stringify(a));assert.equal(a.state.positions.length,before+1);
const b=await post({action:'order',order});assert.equal(b.id,a.id);assert.equal(b.state.positions.length,before+1);
const changed=await post({action:'modify',id:a.id,sl:1.08,tp:1.09});assert.equal(changed.status,200);
const done=await post({action:'close',id:a.id});assert.equal(done.status,200);assert.equal(done.state.positions.find(p=>p.id===a.id).status,'closed');
const again=await post({action:'close',id:a.id});assert.equal(again.status,400);
console.log('PASS: anonymous denial, no-store, origin protection, content type, live disabled, signed-in persistence, rejected order, idempotency, modification, closure, double-close rejection.');


const concurrentKey=crypto.randomUUID();const candidate={...order,key:concurrentKey};const concurrent=await Promise.all([post({action:'order',order:candidate}),post({action:'order',order:candidate})]);assert.ok(concurrent.some(r=>r.status===200));assert.ok(concurrent.every(r=>[200,409].includes(r.status)));const retry=await post({action:'order',order:candidate});assert.equal(retry.status,200);const ledger=await get();assert.equal(ledger.positions.filter(p=>p.key===concurrentKey).length,1);const cleanup=await post({action:'close',id:retry.id});assert.equal(cleanup.status,200);console.log('PASS: simultaneous duplicate submissions reconcile to exactly one position.');

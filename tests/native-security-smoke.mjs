import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {signSession} from '../lib/session.ts';

const origin='http://127.0.0.1:3100';
const secret='test-only-secret-0123456789abcdef0123456789';
const tokens=await Promise.all([1,2].map(id=>signSession({userId:'github:'+id,email:'test'+id+'@example.invalid',displayName:'Audit '+id,fullName:null},secret)));
const server=spawn(process.execPath,['--import','./tests/native-db-fixture.mjs','./node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{
 stdio:['ignore','pipe','pipe'],windowsHide:true,
 env:{...process.env,MFARO_E2E:'1',MFARO_E2E_TOKENS:JSON.stringify(tokens),GITHUB_CLIENT_ID:'audit-client',GITHUB_CLIENT_SECRET:'audit-secret',MFARO_SESSION_SECRET:secret,MFARO_PUBLIC_URL:origin,CLOUDFLARE_ACCOUNT_ID:'audit-account',CLOUDFLARE_D1_DATABASE_ID:'audit-db',CLOUDFLARE_D1_API_TOKEN:'audit-token'},
});
let output='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
const cookie=index=>'mfaro_session='+tokens[index];
const get=async(index=0)=>{const r=await fetch(origin+'/api/terminal',{headers:{Cookie:cookie(index)}});return {status:r.status,...await r.json()};};
const post=async(body,index=0)=>{const r=await fetch(origin+'/api/terminal',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie(index)},body:JSON.stringify(body)});return {status:r.status,...await r.json()};};
try{
 let ready=false;
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw new Error('Native server stopped: '+output);
  try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,'Native server did not become ready.');
 const page=await fetch(origin+'/');assert.equal(page.status,200);
 assert.match(page.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
 assert.equal(page.headers.get('x-frame-options'),'DENY');
 assert.equal(page.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
 assert.equal((await get()).status,200);assert.equal((await get(1)).status,200);
 assert.equal((await fetch(origin+'/api/terminal',{headers:{'oai-authenticated-user-id':'github:1','oai-authenticated-user-email':'forged@example.invalid'}})).status,401);
 const order={symbol:'EUR/USD',side:'buy',type:'Market',lots:.01,key:crypto.randomUUID()};
 const rejected=await post({action:'order',order:{...order,pnl:999999999}});assert.equal(rejected.status,400,JSON.stringify(rejected));
 assert.equal((await post({action:'order',order:{...order,exit:{invalid:true}}})).status,400);
 const created=await post({action:'order',order});assert.equal(created.status,200,JSON.stringify(created));
 assert.equal((await post({action:'order',order})).state.positions.length,1);
 assert.equal((await get(1)).state.positions.length,0);
 assert.equal((await post({action:'close',id:created.id},1)).status,400);
 assert.equal((await post({action:'modify',id:created.id,sl:1,tp:1.2})).status,200);
 const closed=await post({action:'close',id:created.id});assert.equal(closed.status,200);assert.ok(closed.state.balance<100000);
 const pending=await post({action:'order',order:{...order,key:crypto.randomUUID(),type:'Buy limit',entry:1.08}});assert.equal(pending.status,200);
 const cancelled=await post({action:'close',id:pending.id});assert.equal(cancelled.status,200);assert.equal(cancelled.state.balance,closed.state.balance);
 assert.equal((await post({action:'preferences',currency:'USD',theme:'light',notifications:false})).status,200);
 assert.equal((await get()).state.preferences.currency,'USD');
 const history=await fetch(origin+'/api/markets/history?symbol=EUR%2FUSD&interval=1D');assert.equal(history.status,200);
 for(const query of ['symbol=INVALID&interval=1D','symbol=EUR%2FUSD&interval=toString','symbol=EUR%2FUSD&interval=1m'])assert.equal((await fetch(origin+'/api/markets/history?'+query)).status,400);
 assert.equal((await fetch(origin+'/api/markets')).status,200);
 assert.equal((await fetch(origin+'/auth/signout',{redirect:'manual'})).status,405);
 assert.equal((await fetch(origin+'/auth/signout',{method:'POST',headers:{Origin:'https://untrusted.invalid',Cookie:cookie(0)},redirect:'manual'})).status,403);
 const logout=await fetch(origin+'/auth/signout',{method:'POST',headers:{Origin:origin,Cookie:cookie(0)},redirect:'manual'});assert.equal(logout.status,303);
 assert.equal((await get()).status,401,'Copied signed cookie must be revoked.');
 assert.equal((await get(1)).status,200,'Another session must remain active.');
 console.log('PASS: native production headers, two-user isolation, strict orders, persistence, idempotency, margin/settlement, history validation, origin protection and copied-cookie logout revocation. Database and provider responses are in-memory fixtures.');
}finally{server.kill();}

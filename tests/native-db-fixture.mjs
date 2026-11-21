import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Loaded only with --import by native-security-smoke.mjs. No production route,
// environment switch, or real cloud database is used for this in-memory fixture.
if(process.env.MFARO_E2E!=='1'||process.env.CLOUDFLARE_ACCOUNT_ID!=='audit-account')throw new Error('Refusing to load the native test fixture.');
const db=new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../drizzle/0000_fat_chimera.sql',import.meta.url),'utf8'));
db.exec('CREATE TABLE active_sessions(id_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);');
db.exec('CREATE TABLE market_limits(provider TEXT PRIMARY KEY,window_id INTEGER NOT NULL,count INTEGER NOT NULL);');
for(const token of JSON.parse(process.env.MFARO_E2E_TOKENS||'[]')){
 const claims=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8'));
 db.prepare('INSERT INTO active_sessions VALUES(?,?,?)').run(createHash('sha256').update(claims.sessionId).digest('hex'),claims.userId,claims.expires);
}
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(url.origin==='https://api.cloudflare.com'&&url.pathname==='/client/v4/accounts/audit-account/d1/database/audit-db/query'){
  if(new Headers(init?.headers).get('Authorization')!=='Bearer audit-token')return Response.json({success:false},{status:403});
  try{
   const {sql,params=[]}=JSON.parse(init.body);
   const statement=db.prepare(sql);
   const returnsRows=/^\s*SELECT\b/i.test(sql)||/\bRETURNING\b/i.test(sql);
   const results=returnsRows?statement.all(...params):[];
   const info=returnsRows?{changes:Number(db.prepare('SELECT changes() AS n').get().n)}:statement.run(...params);
   return Response.json({success:true,result:[{success:true,results,meta:{changes:Number(info.changes)}}]});
  }catch{return Response.json({success:false},{status:500});}
 }
 if(url.origin==='https://api.frankfurter.dev'){
  const rows=['2026-11-19','2026-11-20'].flatMap((date,index)=>Object.entries({USD:1.1+index*.01,GBP:.85,JPY:165,ZAR:18.5,AUD:1.6,CHF:.95}).map(([quote,rate])=>({date,base:'EUR',quote,rate})));
  return Response.json(rows);
 }
 return original(input,init);
};
